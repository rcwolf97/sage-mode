#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { stdin } from "node:process";
import { VERSION, fail, flag, opt, takeRest, pluginRoot, gitRoot } from "./util.js";
import { setup, checkHealth, uninstall } from "./setup/index.js";
import { lint } from "./lint/index.js";
import { render, renderAll, index as notebookIndex, copyAssets } from "./notebook/index.js";
import { run as evidenceRun, check as evidenceCheck, trust, wtree } from "./evidence/index.js";
import { validateFile, loadDag, plan as dagPlan, lanes, worktree } from "./dag/index.js";
import {
  parseJsonl,
  toJsonl,
  gate,
  dedup,
  scope as reviewScope,
  select as reviewSelect,
  checkRecommendation,
} from "./review/index.js";
import { consult } from "./consult/index.js";
import {
  loadLedger,
  saveLedger,
  parseLedger,
  next as boardNext,
  writeStatus,
  writeBlocker,
  writeAnswer,
  activeSprint,
  evaluateCircuitBreaker,
  loadLedgerOrThrow,
  evaluateCircuitBreakerForSprint,
  LedgerNotFoundError,
} from "./board/index.js";
import { buildIndex, saveIndex, loadIndex, search, dedupAppliesWhen } from "./recall/index.js";
import { list as egressList, verify as egressVerify, grants as egressGrants } from "./egress/index.js";
import { projectSageDir } from "./util.js";

function help(): string {
  return `sage ${VERSION}

Usage:
  sage --version
  sage setup [--profile web|api|cli|ai-product] [--no-project-agents]
  sage setup --check [--json]             # read-only capability report; exit 0 even with gaps
  sage uninstall [--purge-user-config] [--yes] [--json]
  sage lint
  sage status [--json]
  sage unsafe <reason>
  sage notebook render [--watch] [--strict] [file.md]
  sage notebook index
  sage evidence run --label L [--node N] [--allow-unignored] -- <cmd>
  sage evidence check --label L [--expect-cmd C] [--max-age H] [--allow-paths P]
  sage evidence trust --command C
  sage dag validate <dag.json>
  sage dag plan <dag.json> [--fenced]
  sage dag lanes <dag.json> --wave N      # 0-indexed, matches \`dag plan\` waves; default 0
  sage dag worktree <nodeId> --dag <dag.json>
  sage review gate                        # rejects malformed rows loudly; exits non-zero if any
  sage review dedup
  sage review scope --base <ref> [--fenced]
  sage review select --scope <json> [--stats <file>] [--all-specialists] [--fenced]
  sage review recommendation [--file F]   # reads markdown from stdin if no --file
  sage consult --role R [--brief F] [--schema S] [--session]
  sage board next [--sprint S] [--fenced]
  sage board status --sprint S --node N --state S
  sage board blocker --sprint S --node N
  sage board answer --sprint S --node N
  sage board ledger [--sprint S]
  sage board wtf [--sprint S] [--fenced]
  sage egress list [--sprint S] [--json]
  sage egress verify [--json] [--fenced]  # exit 3 on a broken chain, 0 when ok
  sage egress grants [--json]
  sage recall index
  sage recall "<query>" [--kind K] [-n N]
  sage recall dedup --applies-when "<text>"

All subcommands accept --json. Non-zero exit on failure.

--fenced (dag plan, review scope, review select, board wtf, board next,
egress verify): wraps stdout in "=== sage <verb> begin ===" / "=== sage
<verb> end ===" markers. Seeing one marker without the other means the
output was truncated — re-run the command verbatim, never trust the
partial payload.
`;
}

async function readStdin(): Promise<string> {
  if (stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const c of stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function asJson(argv: string[]): boolean {
  return flag(argv, "json");
}

function print(value: unknown, json: boolean, text?: string): void {
  if (json) process.stdout.write(JSON.stringify(value, null, 2) + "\n");
  else if (text !== undefined) process.stdout.write(text + (text.endsWith("\n") ? "" : "\n"));
  else process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

// Truncation sentinels (see help() and A1 in the task): several verbs emit
// JSON an agent reads and acts on programmatically. A payload cut off
// mid-stream by a context limit or a pipe error can still be valid-looking
// text right up to the cut — the risk is a silently-wrong partial answer,
// not a parse error. --fenced is strictly opt-in (never the default) and
// wraps the exact same output print() would have produced in begin/end
// markers naming the verb, so a caller that sees only one marker knows,
// mechanically, to re-run rather than trust what it has.
function printFenced(verb: string, fenced: boolean, value: unknown, json: boolean, text?: string): void {
  if (fenced) process.stdout.write(`=== sage ${verb} begin ===\n`);
  print(value, json, text);
  if (fenced) process.stdout.write(`=== sage ${verb} end ===\n`);
}

// Compact, aligned table for human-readable audit surfaces (`sage egress
// list`) — someone actually reads this, so columns line up.
function renderTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] || "").length)));
  const line = (cols: string[]) => cols.map((c, i) => (c || "").padEnd(widths[i]!)).join("  ").trimEnd();
  return [line(headers), ...rows.map(line)].join("\n");
}

// `LedgerNotFoundError` shared reporter for `board wtf`/`board ledger` (B2):
// in --json mode the caller gets a structured, machine-readable error object
// instead of a bare non-zero exit; in human mode the actionable message goes
// to stderr via fail(), never silently swallowed.
function reportLedgerNotFound(verb: string, fenced: boolean, e: LedgerNotFoundError, json: boolean): number {
  if (json) {
    printFenced(verb, fenced, { error: { code: e.code, sprint: e.sprint, expectedPath: e.expectedPath, message: e.message } }, true);
    return 1;
  }
  return fail(e.message);
}

function renderFilesReport(f: { written: string[]; preserved: string[]; refreshed: string[] }): string {
  const section = (label: string, paths: string[]) =>
    paths.length ? `  ${label} (${paths.length}):\n${paths.map((p) => `    ${p}`).join("\n")}` : `  ${label} (0)`;
  return [
    `files: ${f.written.length} written, ${f.refreshed.length} refreshed, ${f.preserved.length} preserved`,
    section("written", f.written),
    section("refreshed", f.refreshed),
    section("preserved (left alone)", f.preserved),
  ].join("\n");
}

function renderHealthReport(h: ReturnType<typeof checkHealth>): string {
  const lines: string[] = [];
  lines.push(`sage home: ${h.sageHome}`);
  lines.push(`project: ${h.project}`);
  lines.push(`notebook root: ${h.notebook.root} (source: ${h.notebook.source})`);
  lines.push("interpreters:");
  for (const i of h.interpreters) {
    lines.push(`  ${i.name}: present=${i.present} runs=${i.runs}${i.version ? ` version=${JSON.stringify(i.version)}` : ""}`);
  }
  lines.push(`gitignore: .sage/=${h.gitignore.sageIgnored} .worktrees/=${h.gitignore.worktreesIgnored}`);
  lines.push("verify commands:");
  if (h.verify.length) {
    for (const v of h.verify) lines.push(`  ${v.key}: ${JSON.stringify(v.command)} resolvable=${v.resolvable}`);
  } else {
    lines.push("  none configured");
  }
  lines.push(
    `manifest: ${h.manifest.ownedClean} owned-clean, ${h.manifest.ownedModified} owned-modified, ${h.manifest.unowned} unowned, ${h.manifest.missing} missing`,
  );
  lines.push(`gaps (${h.gaps.length}):`);
  lines.push(h.gaps.length ? h.gaps.map((g) => `  - ${g}`).join("\n") : "  none");
  lines.push(`ok: ${h.ok}`);
  return lines.join("\n");
}

function renderUninstallReport(r: ReturnType<typeof uninstall>): string {
  const lines: string[] = [];
  lines.push(`removed (${r.removed.length}):`);
  lines.push(r.removed.length ? r.removed.map((p) => `  - ${p}`).join("\n") : "  none");
  lines.push(`preserved (${r.preserved.length}):`);
  lines.push(r.preserved.length ? r.preserved.map((p) => `  - ${p.path} (${p.reason})`).join("\n") : "  none");
  return lines.join("\n");
}

async function main(argv: string[]): Promise<number> {
  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
    process.stdout.write(help());
    return 0;
  }
  if (argv[0] === "--version" || argv[0] === "-v" || argv[0] === "version") {
    process.stdout.write(VERSION + "\n");
    return 0;
  }
  const cmd = argv[0]!;
  const rest = argv.slice(1);
  const json = asJson(rest);

  if (cmd === "setup") {
    if (flag(rest, "check")) {
      // Read-only: never writes. A missing optional capability is a reported
      // gap, not a failure — exit non-zero only when checkHealth's own `ok`
      // is false (a broken, not merely absent, capability).
      const h = checkHealth();
      print(h, json, renderHealthReport(h));
      return h.ok ? 0 : 1;
    }
    const r = setup({
      profile: opt(rest, "profile"),
      noProjectAgents: flag(rest, "no-project-agents"),
    });
    print(
      r,
      json,
      `sage ${VERSION} installed\nSAGE_HOME=${r.sageHome}\nshim=${r.shim}\n${renderFilesReport(r.files)}\n`,
    );
    return 0;
  }

  if (cmd === "uninstall") {
    const purgeUserConfig = flag(rest, "purge-user-config");
    const yes = flag(rest, "yes");
    // Guard the delete behind an explicit confirmation: --yes says "I mean
    // it" for a human at a terminal; --json says "a script is driving this
    // and already decided" (no TTY to prompt anyway). Anything else refuses
    // to touch disk and explains how to proceed.
    if (!yes && !json) {
      fail(
        "sage uninstall removes files sage installed — re-run with --yes to confirm " +
          "(or --json to run non-interactively)",
      );
    }
    const r = uninstall({ purgeUserConfig });
    print(r, json, renderUninstallReport(r));
    return 0;
  }

  if (cmd === "lint") {
    const issues = lint(opt(rest, "root") || pluginRoot);
    print({ issues }, json, issues.length ? issues.map((i) => `${i.file}: ${i.rule}: ${i.message}`).join("\n") : "ok");
    return issues.length ? 1 : 0;
  }

  if (cmd === "status") {
    const sprint = activeSprint();
    const n = sprint ? boardNext(sprint) : { action: "done", nodes: [], reason: "no sprint" };
    print({ sprint, ...n }, json);
    return 0;
  }

  if (cmd === "unsafe") {
    const reason = rest.filter((a) => !a.startsWith("-")).join(" ") || "unspecified";
    const dir = projectSageDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      `${dir}/unsafe`,
      JSON.stringify({ reason, ts: new Date().toISOString(), once: true }) + "\n",
    );
    print({ ok: true, reason }, json, `one-turn unsafe token written: ${reason}`);
    return 0;
  }

  if (cmd === "notebook") {
    const sub = rest[0];
    if (sub === "render") {
      const file = rest.find((a, i) => i > 0 && !a.startsWith("-"));
      const strict = flag(rest, "strict");
      try {
        if (file) {
          const out = render(file, { strict });
          print({ out }, json, out);
        } else {
          const outs = renderAll(undefined, { strict });
          print({ outs }, json, outs.join("\n"));
        }
        return 0;
      } catch (e) {
        fail((e as Error).message);
      }
    }
    if (sub === "index") {
      const out = notebookIndex();
      print({ out }, json, out);
      return 0;
    }
    fail("sage notebook render|index");
  }

  if (cmd === "evidence") {
    const sub = rest[0];
    if (sub === "run") {
      const { rest: cmdv } = takeRest(rest);
      const label = opt(rest, "label");
      if (!label || !cmdv.length) fail("sage evidence run --label L [--node N] [--allow-unignored] -- <cmd>");
      return await evidenceRun({
        label,
        command: cmdv,
        node: opt(rest, "node"),
        allowUnignored: flag(rest, "allow-unignored"),
      });
    }
    if (sub === "check") {
      const label = opt(rest, "label");
      if (!label) fail("sage evidence check --label L");
      const r = evidenceCheck({
        label,
        expectCmd: opt(rest, "expect-cmd"),
        maxAgeHours: opt(rest, "max-age") ? Number(opt(rest, "max-age")) : undefined,
        allowPaths: opt(rest, "allow-paths")?.split(","),
      });
      print(r, json, `${r.grade} ${r.reason}`);
      return r.grade === "FRESH" ? 0 : 1;
    }
    if (sub === "trust") {
      const c = opt(rest, "command");
      if (!c) fail("sage evidence trust --command C");
      trust(c);
      print({ ok: true }, json, "trusted");
      return 0;
    }
    if (sub === "wtree") {
      const w = wtree();
      print({ wtree: w }, json, w || "");
      return w ? 0 : 1;
    }
    fail("sage evidence run|check|trust");
  }

  if (cmd === "dag") {
    const sub = rest[0];
    const file = rest.find((a, i) => i > 0 && !a.startsWith("-") && a.endsWith(".json")) || rest[1];
    if (sub === "validate") {
      if (!file) fail("sage dag validate <dag.json>");
      const v = validateFile(file);
      print({ violations: v }, json, v.length ? v.map((x) => `${x.code}: ${x.message}`).join("\n") : "ok");
      return v.length ? 1 : 0;
    }
    if (sub === "plan") {
      if (!file) fail("sage dag plan <dag.json>");
      const fenced = flag(rest, "fenced");
      const dag = loadDag(file);
      const v = validateFile(file);
      if (v.length) {
        printFenced("dag plan", fenced, { violations: v }, json, v.map((x) => `${x.code}: ${x.message}`).join("\n"));
        return 1;
      }
      const p = dagPlan(dag);
      printFenced("dag plan", fenced, p, json);
      return 0;
    }
    if (sub === "lanes") {
      if (!file) fail("sage dag lanes <dag.json> --wave N");
      // lanes() is 0-indexed, matching plan().waves (wave 0 is the first
      // wave) — default and pass-through must agree with that, not the old
      // 1-indexed convention. A malformed --wave must be rejected here,
      // clearly, rather than becoming Number("x") === NaN and reaching
      // lanes() as a silently-wrong waveIndex.
      const waveRaw = opt(rest, "wave") ?? "0";
      if (!/^-?\d+$/.test(waveRaw)) {
        fail(`sage dag lanes --wave must be an integer, got ${JSON.stringify(waveRaw)}`);
      }
      const wave = Number(waveRaw);
      const dag = loadDag(file);
      const v = lanes(dag, wave);
      print({ violations: v }, json, v.length ? v.map((x) => `${x.code}: ${x.message}`).join("\n") : "ok");
      return v.length ? 1 : 0;
    }
    if (sub === "worktree") {
      const nodeId = rest[1];
      const dagFile = opt(rest, "dag");
      if (!nodeId || !dagFile) fail("sage dag worktree <nodeId> --dag <dag.json>");
      const dag = loadDag(dagFile);
      // worktree() shells out to `git worktree add ... <dag.base>` — nothing
      // upstream (schema-only validate()) ever confirms dag.base resolves to
      // a real ref, so a bad base surfaces here, at the point git actually
      // rejects it. Without this catch, that Error propagated uncaught to
      // main()'s top-level handler, which dumps a raw stack trace to stderr
      // instead of the structured `{"violations": [...]}` shape every other
      // `sage dag` subcommand uses on failure — a broken base ref looked
      // like a crash, not a clean, reportable violation.
      try {
        const p = worktree(nodeId, dag);
        print({ path: p }, json, p);
        return 0;
      } catch (e) {
        const message = (e as Error).message || String(e);
        const v = [{ code: "git", message: `dag.base did not resolve: ${message}` }];
        print({ violations: v }, json, v.map((x) => `${x.code}: ${x.message}`).join("\n"));
        return 1;
      }
    }
    fail("sage dag validate|plan|lanes|worktree");
  }

  if (cmd === "review") {
    const sub = rest[0];
    if (sub === "gate") {
      // gate() now rejects rows that fail finding-schema validation instead
      // of silently dropping them (its non-enumerable `.rejected`). A
      // malformed row from a broken specialist must look like a broken
      // specialist here, not a clean bill of health — so rejects are always
      // surfaced, and their presence alone flips the exit code non-zero,
      // independent of how many findings validated cleanly.
      const input = await readStdin();
      const findings = parseJsonl(input);
      const out = gate(findings);
      const rejected = out.rejected;
      if (json) {
        print({ findings: out, rejected }, true);
      } else {
        const body = toJsonl(out);
        process.stdout.write(body);
        if (rejected.length) {
          if (body && !body.endsWith("\n")) process.stdout.write("\n");
          process.stdout.write(`REJECTED (${rejected.length})\n`);
          for (const r of rejected) process.stdout.write(`  - ${r.reason}\n`);
        }
      }
      return rejected.length ? 1 : 0;
    }
    if (sub === "dedup") {
      const input = await readStdin();
      const findings = parseJsonl(input);
      const out = dedup(findings);
      if (json) print(out, true);
      else process.stdout.write(toJsonl(out));
      return 0;
    }
    if (sub === "scope") {
      const base = opt(rest, "base");
      if (!base) fail("sage review scope --base <ref>");
      const fenced = flag(rest, "fenced");
      const s = reviewScope({ base });
      printFenced("review scope", fenced, s, true);
      if (s.error === "no_base") {
        process.stderr.write("SCOPE_ERROR=no_base\n");
        return 2;
      }
      if (s.error === "unmatched") {
        process.stderr.write("SCOPE_ERROR=unmatched\n");
        return 2;
      }
      return 0;
    }
    if (sub === "select") {
      const raw = opt(rest, "scope");
      if (!raw) fail("sage review select --scope <json>");
      const fenced = flag(rest, "fenced");
      const s = JSON.parse(raw.startsWith("{") ? raw : readFileSync(raw, "utf8"));
      let stats;
      const statsFile = opt(rest, "stats");
      if (statsFile && existsSync(statsFile)) stats = JSON.parse(readFileSync(statsFile, "utf8"));
      const roster = reviewSelect({
        scope: s,
        stats,
        all: flag(rest, "all-specialists"),
      });
      printFenced("review select", fenced, { roster }, json);
      return 0;
    }
    if (sub === "recommendation") {
      // Closes a real gap an independent complex-workload review found: this
      // check existed as tested code (checkRecommendation) and skills/
      // sage-review/SKILL.md instructed the agent to run it, but no CLI verb
      // ever called it — the only interface the workflow actually teaches
      // the agent to use. A faithfully-instructed agent had no way to reach
      // it short of hand-writing a throwaway `node -e` script, which is the
      // same self-report failure mode this mechanism exists to close.
      const file = opt(rest, "file");
      const markdown = file ? readFileSync(file, "utf8") : await readStdin();
      const result = checkRecommendation(markdown);
      print(result, json, result.issues.join("\n"));
      return result.ok ? 0 : 1;
    }
    fail("sage review gate|dedup|scope|select|recommendation");
  }

  if (cmd === "consult") {
    const role = opt(rest, "role") as "product" | "qa-analyst" | "architect" | undefined;
    if (!role) fail("sage consult --role R");
    const r = consult({
      role,
      brief: opt(rest, "brief"),
      schema: opt(rest, "schema"),
      session: flag(rest, "session"),
      prompt: opt(rest, "prompt"),
    });
    print(r, json, r.text || r.error || "");
    return r.ok ? 0 : r.exit || 3;
  }

  if (cmd === "board") {
    const sub = rest[0];
    const sprint = opt(rest, "sprint") || activeSprint() || "";
    if (sub === "next") {
      if (!sprint) fail("no sprint");
      const fenced = flag(rest, "fenced");
      const n = boardNext(sprint);
      printFenced("board next", fenced, n, json);
      return 0;
    }
    if (sub === "status") {
      const node = opt(rest, "node");
      const state = opt(rest, "state") as Parameters<typeof writeStatus>[2];
      if (!sprint || !node || !state) fail("sage board status --sprint S --node N --state S");
      writeStatus(sprint, node, state);
      return 0;
    }
    if (sub === "blocker") {
      const node = opt(rest, "node");
      if (!sprint || !node) fail("sage board blocker --sprint S --node N");
      const body = await readStdin();
      writeBlocker(sprint, node, body);
      return 0;
    }
    if (sub === "answer") {
      const node = opt(rest, "node");
      if (!sprint || !node) fail("sage board answer --sprint S --node N");
      const body = await readStdin();
      writeAnswer(sprint, node, body);
      return 0;
    }
    if (sub === "ledger") {
      // Was `const l = loadLedger(sprint); print(l, json); return l ? 0 : 1;`
      // — a missing ledger fell through to `print(null, json)` (nothing on
      // stdout in human mode, since print()'s text branch never fires for a
      // null value with no `text` arg... in practice this produced no
      // actionable output at all) and a bare exit 1. loadLedgerOrThrow gives
      // an actionable, typed error instead (B2).
      if (!sprint) fail("no sprint");
      try {
        const l = loadLedgerOrThrow(sprint);
        print(l, json);
        return 0;
      } catch (e) {
        if (e instanceof LedgerNotFoundError) return reportLedgerNotFound("board ledger", false, e, json);
        throw e;
      }
    }
    if (sub === "wtf") {
      // Same gap as `sage review recommendation` above: evaluateCircuitBreaker
      // (lib/board/index.ts) was real, unit-tested code with no CLI verb
      // calling it — skills/sage-build/SKILL.md tells the Eng Manager
      // persona, in prose, "the Eng Manager never writes a WTF-LIKELIHOOD
      // number into the ledger by hand," but the only tool surface it's
      // taught to use (`sage <verb>`) had no way to actually compute one.
      // evaluateCircuitBreakerForSprint throws LedgerNotFoundError instead of
      // letting a missing ledger fall through as a silent exit 1 (B2).
      if (!sprint) fail("no sprint");
      const fenced = flag(rest, "fenced");
      try {
        const result = evaluateCircuitBreakerForSprint(sprint);
        printFenced(
          "board wtf",
          fenced,
          result,
          json,
          `wtf=${result.score}% stopAndAsk=${result.stopAndAsk} hardCapReached=${result.hardCapReached}`,
        );
        return 0;
      } catch (e) {
        if (e instanceof LedgerNotFoundError) return reportLedgerNotFound("board wtf", fenced, e, json);
        throw e;
      }
    }
    fail("sage board next|status|blocker|answer|ledger|wtf");
  }

  if (cmd === "egress") {
    const sub = rest[0];
    const root = gitRoot() || process.cwd();
    if (sub === "list") {
      const rows = egressList(root, { sprint: opt(rest, "sprint") });
      const text = rows.length
        ? renderTable(
            ["seq", "ts", "sink", "model", "lane", "bytes", "redactions"],
            rows.map((r) => [String(r.seq), r.ts, r.sink, r.model, r.lane, String(r.bytes), String(r.redactions)]),
          )
        : "no egress recorded";
      print({ rows }, json, text);
      return 0;
    }
    if (sub === "verify") {
      const fenced = flag(rest, "fenced");
      const v = egressVerify(root);
      const text = v.ok ? `ok — ${v.reason}` : `BROKEN at seq ${v.brokenAt} — ${v.reason}`;
      printFenced("egress verify", fenced, v, json, text);
      return v.ok ? 0 : 3;
    }
    if (sub === "grants") {
      const g = egressGrants(root);
      const text = g.length
        ? renderTable(
            ["lane", "sink", "model", "revokeCommand"],
            g.map((x) => [x.lane, x.sink, x.model, x.revokeCommand]),
          )
        : "no active egress grants";
      print({ grants: g }, json, text);
      return 0;
    }
    fail("sage egress list|verify|grants");
  }

  if (cmd === "recall") {
    const sub = rest[0];
    if (sub === "index") {
      const idx = buildIndex();
      const p = saveIndex(idx);
      print({ path: p, N: idx.stats.N }, json, `indexed ${idx.stats.N} docs → ${p}`);
      return 0;
    }
    if (sub === "dedup") {
      const text = opt(rest, "applies-when");
      if (!text) fail("sage recall dedup --applies-when TEXT");
      const idx = loadIndex() || buildIndex();
      const hits = dedupAppliesWhen(idx, text);
      print(hits, json);
      return 0;
    }
    const q = rest.filter((a) => !a.startsWith("-")).join(" ").replace(/^recall\s+/, "") || sub || "";
    if (!q || q === "index") fail('sage recall "<query>"');
    const idx = loadIndex() || buildIndex();
    const hits = search(idx, q.replace(/^["']|["']$/g, ""), {
      kind: opt(rest, "kind"),
      n: opt(rest, "n") ? Number(opt(rest, "n")) : 5,
    });
    print(hits, json, hits.length ? hits.map((h) => `${h.score.toFixed(3)}\t${h.kind}\t${h.path}\t${h.title}`).join("\n") : "no results");
    return 0;
  }

  process.stderr.write(help());
  return 1;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(String(err?.stack || err) + "\n");
    process.exit(1);
  },
);

void copyAssets;
void saveLedger;
void parseLedger;
void writeFileSync;
void existsSync;
