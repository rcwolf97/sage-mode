#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { stdin } from "node:process";
import { VERSION, fail, flag, opt, takeRest, pluginRoot } from "./util.js";
import { setup } from "./setup/index.js";
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
} from "./board/index.js";
import { buildIndex, saveIndex, loadIndex, search, dedupAppliesWhen } from "./recall/index.js";
import { projectSageDir } from "./util.js";

function help(): string {
  return `sage ${VERSION}

Usage:
  sage --version
  sage setup [--profile web|api|cli|ai-product] [--no-project-agents]
  sage lint
  sage status [--json]
  sage unsafe <reason>
  sage notebook render [--watch] [--strict] [file.md]
  sage notebook index
  sage evidence run --label L [--node N] -- <cmd>
  sage evidence check --label L [--expect-cmd C] [--max-age H] [--allow-paths P]
  sage evidence trust --command C
  sage dag validate <dag.json>
  sage dag plan <dag.json>
  sage dag lanes <dag.json> --wave N
  sage dag worktree <nodeId> --dag <dag.json>
  sage review gate
  sage review dedup
  sage review scope --base <ref>
  sage review select --scope <json> [--stats <file>] [--all-specialists]
  sage review recommendation [--file F]   # reads markdown from stdin if no --file
  sage consult --role R [--brief F] [--schema S] [--session]
  sage board next [--sprint S]
  sage board status --sprint S --node N --state S
  sage board blocker --sprint S --node N
  sage board answer --sprint S --node N
  sage board ledger [--sprint S]
  sage board wtf [--sprint S]
  sage recall index
  sage recall "<query>" [--kind K] [-n N]
  sage recall dedup --applies-when "<text>"

All subcommands accept --json. Non-zero exit on failure.
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
    const r = setup({
      profile: opt(rest, "profile"),
      noProjectAgents: flag(rest, "no-project-agents"),
    });
    print(r, json, `sage ${VERSION} installed\nSAGE_HOME=${r.sageHome}\nshim=${r.shim}\n`);
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
      if (!label || !cmdv.length) fail("sage evidence run --label L -- <cmd>");
      return await evidenceRun({ label, command: cmdv, node: opt(rest, "node") });
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
      const dag = loadDag(file);
      const v = validateFile(file);
      if (v.length) {
        print({ violations: v }, json, v.map((x) => `${x.code}: ${x.message}`).join("\n"));
        return 1;
      }
      const p = dagPlan(dag);
      print(p, json);
      return 0;
    }
    if (sub === "lanes") {
      if (!file) fail("sage dag lanes <dag.json> --wave N");
      const wave = Number(opt(rest, "wave") || "1");
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
    if (sub === "gate" || sub === "dedup") {
      const input = await readStdin();
      const findings = parseJsonl(input);
      const out = sub === "gate" ? gate(findings) : dedup(findings);
      if (json) print(out, true);
      else process.stdout.write(toJsonl(out));
      return 0;
    }
    if (sub === "scope") {
      const base = opt(rest, "base");
      if (!base) fail("sage review scope --base <ref>");
      const s = reviewScope({ base });
      print(s, true);
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
      const s = JSON.parse(raw.startsWith("{") ? raw : readFileSync(raw, "utf8"));
      let stats;
      const statsFile = opt(rest, "stats");
      if (statsFile && existsSync(statsFile)) stats = JSON.parse(readFileSync(statsFile, "utf8"));
      const roster = reviewSelect({
        scope: s,
        stats,
        all: flag(rest, "all-specialists"),
      });
      print({ roster }, json);
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
      const n = boardNext(sprint);
      print(n, json);
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
      if (!sprint) fail("no sprint");
      const l = loadLedger(sprint);
      print(l, json);
      return l ? 0 : 1;
    }
    if (sub === "wtf") {
      // Same gap as `sage review recommendation` above: evaluateCircuitBreaker
      // (lib/board/index.ts) was real, unit-tested code with no CLI verb
      // calling it — skills/sage-build/SKILL.md tells the Eng Manager
      // persona, in prose, "the Eng Manager never writes a WTF-LIKELIHOOD
      // number into the ledger by hand," but the only tool surface it's
      // taught to use (`sage <verb>`) had no way to actually compute one.
      if (!sprint) fail("no sprint");
      const l = loadLedger(sprint);
      if (!l) return 1;
      const result = evaluateCircuitBreaker(l);
      print(result, json, `wtf=${result.score}% stopAndAsk=${result.stopAndAsk} hardCapReached=${result.hardCapReached}`);
      return 0;
    }
    fail("sage board next|status|blocker|answer|ledger|wtf");
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
