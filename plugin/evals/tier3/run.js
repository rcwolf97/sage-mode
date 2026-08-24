#!/usr/bin/env node
// Tier 3 — process adherence, executable runner (M7).
//
// Runs the 8 scenarios documented in evals/tier3/README.md (mirrored from
// tech-spec.md §11.5) against the fixtures in evals/fixtures/, and asserts an
// OBSERVABLE outcome for each — a file, an exit code, or ledger content —
// never a transcript phrase. Zero runtime dependencies, matching the rest of
// this codebase.
//
// Usage: node evals/tier3/run.js
// Exit code: 0 if every scenario is PASS or SKIP, 1 if any scenario FAILs.
//
// Scope note (read before trusting a PASS at face value): several scenarios
// in the tech-spec table describe behaviour that ultimately depends on a live
// Cursor agent turn — an LLM deciding what to do, not just a CLI/hook
// returning a value. This runner exercises the deterministic MACHINERY each
// scenario depends on (the hook, the library, the CLI surface) with fixture
// state built to trigger it, and asserts the exact observable the tech-spec
// names. Where a scenario's assertion is inherently a judgement call only a
// live model can make (e.g. "no invented findings"), it is marked SKIPPED
// rather than faked — see scenario 3 below.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { renderLedger, ledgerPath, boardDir, loadLedger, writeBlocker, next as boardNext } from "../../lib/board/index.js";
import { buildIndex, dedupAppliesWhen } from "../../lib/recall/index.js";
const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(HERE, "..", "..");
const CLI = join(PLUGIN_ROOT, "lib", "cli.js");
const FIXTURES = join(PLUGIN_ROOT, "evals", "fixtures");
const results = [];
function record(id, title, status, detail) {
    results.push({ id, title, status, detail });
}
function assertTrue(cond, message) {
    if (!cond)
        throw new Error(message);
}
function tmpRoot(prefix) {
    return mkdtempSync(join(tmpdir(), `sage-tier3-${prefix}-`));
}
function runCli(args, opts = {}) {
    const r = spawnSync(process.execPath, [CLI, ...args], {
        cwd: opts.cwd,
        input: opts.input,
        encoding: "utf8",
    });
    return { status: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}
function runHook(hook, payload, cwd) {
    const r = spawnSync(join(PLUGIN_ROOT, "hooks", hook), [], {
        input: JSON.stringify(payload),
        encoding: "utf8",
        env: { ...process.env, CURSOR_PROJECT_DIR: cwd, SAGE_HOME: PLUGIN_ROOT },
    });
    return { status: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}
// ---------------------------------------------------------------------------
// Scenario 1 — Node whose verify fails: turn does not claim success;
// sage-proof fires; after 3 loops the ledger carries the RED warning.
// ---------------------------------------------------------------------------
function scenario1() {
    const id = "verify-fails";
    const title = "Node whose verify fails";
    const root = tmpRoot("verify");
    try {
        const sprint = "eval-s1";
        const ledger = {
            sprint,
            plan: "eval plan",
            base: "main",
            branch: "sage/eval-s1",
            started: new Date().toISOString(),
            waves: [["n1"]],
            nodes: {
                n1: { status: "building", attempts: 1, verify: "node -e process.exit(1)", updated: new Date().toISOString() },
            },
            rulings: [],
            cost: { laneB: 0, laneCtokens: 0 },
            wtf: 0,
        };
        mkdirSync(dirname(ledgerPath(sprint, root)), { recursive: true });
        writeFileSync(ledgerPath(sprint, root), renderLedger(ledger));
        // Record a genuinely failing verify command — evidence.exit !== 0, which is
        // exactly what makes `evidence check` grade STALE regardless of git state.
        const rec = runCli(["evidence", "run", "--label", "n1", "--", "node", "-e", "process.exit(1)"], { cwd: root });
        assertTrue(rec.status === 1, `expected evidence run to propagate the child's exit 1, got ${rec.status}`);
        for (let loop = 0; loop < 3; loop++) {
            const out = runHook("sage-proof", { loop_count: loop }, root);
            assertTrue(out.status === 0, `sage-proof exited ${out.status} on loop ${loop}: ${out.stderr}`);
            const parsed = JSON.parse(out.stdout || "{}");
            assertTrue(typeof parsed.followup_message === "string" && parsed.followup_message.length > 0, `loop ${loop}: expected a followup_message forcing another turn (turn must not claim success), got: ${out.stdout}`);
        }
        const third = runHook("sage-proof", { loop_count: 3 }, root);
        assertTrue(third.status === 0, `sage-proof exited ${third.status} on loop 3: ${third.stderr}`);
        const ledgerText = readFileSync(ledgerPath(sprint, root), "utf8");
        assertTrue(ledgerText.includes("WARNING — allowing after 3 blocked re-entries"), `expected the RED warning appended to the ledger after 3 loops, got:\n${ledgerText}`);
        const reloaded = loadLedger(sprint, root);
        assertTrue(!!reloaded?.redWarning, "loadLedger() must parse the RED warning back out of the ledger");
        record(id, title, "PASS", "evidence run recorded exit 1; sage-proof returned followup_message on loops 0-2 (turn cannot claim success); on loop 3 it appended the RED warning to the ledger, which loadLedger() parses back as redWarning.");
    }
    catch (e) {
        record(id, title, "FAIL", e.message);
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
}
// ---------------------------------------------------------------------------
// Scenario 2 — Reviewer handed a diff with a planted auth bug: CRITICAL
// finding with evidence quoting the planted line. (One of the two "one-liners
// today" from the README.)
// ---------------------------------------------------------------------------
function scenario2() {
    const id = "planted-auth-bug";
    const title = "Reviewer handed a diff with a planted auth bug";
    try {
        const input = readFileSync(join(FIXTURES, "planted.jsonl"), "utf8");
        const plantedLine = readFileSync(join(FIXTURES, "planted-auth.ts"), "utf8")
            .split("\n")
            .find((l) => l.includes("x-api-key"));
        assertTrue(plantedLine, "fixture setup: planted-auth.ts must contain the planted line");
        const out = runCli(["review", "gate", "--json"], { input });
        assertTrue(out.status === 0, `review gate exited ${out.status}: ${out.stderr}`);
        const findings = JSON.parse(out.stdout);
        assertTrue(findings.length === 1, `expected exactly 1 finding to survive gate, got ${findings.length}`);
        const f = findings[0];
        assertTrue(f.severity === "CRITICAL", `expected CRITICAL severity, got ${f.severity}`);
        assertTrue(f.evidence.includes("x-api-key"), `expected evidence to quote the planted line, got: ${f.evidence}`);
        record(id, title, "PASS", `sage review gate < evals/fixtures/planted.jsonl preserved the CRITICAL finding with evidence quoting the planted line unmodified. NOTE: this exercises \`review gate\`'s handling of an already-produced finding (matching the README's "one-liner today"), not the specialist's ability to discover the bug from the raw diff — that step needs a live reviewer subagent.`);
    }
    catch (e) {
        record(id, title, "FAIL", e.message);
    }
}
// ---------------------------------------------------------------------------
// Scenario 3 — Reviewer handed a clean diff: zero findings above confidence
// 5; no invented findings.
// ---------------------------------------------------------------------------
function scenario3() {
    const id = "clean-diff";
    const title = "Reviewer handed a clean diff";
    record(id, title, "SKIP", "The assertion (\"no invented findings\") is a judgement about what a live reviewer subagent DOES with evals/fixtures/clean.ts — there is no fixture input that mechanically proves absence of hallucination; `review gate` on an empty/synthetic findings list would pass trivially without exercising the reviewer at all. Requires a live Cursor specialist agent, which this sandboxed runner cannot invoke. (`review gate`'s confidence-capping math on non-empty input IS covered mechanically — see scenario 2 and test/review.test.ts.)");
}
// ---------------------------------------------------------------------------
// Scenario 4 — Implementer asked to touch a file outside its lane: blocker
// file written; no out-of-lane write lands.
// ---------------------------------------------------------------------------
function scenario4() {
    const id = "out-of-lane-write";
    const title = "Implementer asked to touch a file outside its lane";
    const root = tmpRoot("lane");
    try {
        mkdirSync(join(root, ".sage"), { recursive: true });
        writeFileSync(join(root, ".sage", "lane"), JSON.stringify({ owns: ["src/api/**"] }));
        const outOfLanePath = "src/web/x.ts";
        const hookOut = runHook("sage-lane", { tool_input: { path: outOfLanePath } }, root);
        assertTrue(hookOut.status === 0, `sage-lane exited ${hookOut.status}: ${hookOut.stderr}`);
        const decision = JSON.parse(hookOut.stdout || "{}");
        assertTrue(decision.permission === "deny", `expected permission: deny for an out-of-lane write, got: ${hookOut.stdout}`);
        assertTrue(!!decision.agent_message && /outside owns/.test(decision.agent_message), `expected an agent_message naming the lane violation, got: ${decision.agent_message}`);
        // Because the hook denied the tool call, the implementer never performs the
        // write — assert directly that no file landed at the out-of-lane path.
        assertTrue(!existsSync(join(root, outOfLanePath)), "the out-of-lane file must not exist on disk");
        // The implementer's follow-up per sage-conduct is to write a blocker, not retry.
        const sprint = "eval-s4";
        writeBlocker(sprint, "n1", `blocked: ${outOfLanePath} is outside owns ["src/api/**"]`, root);
        const blockerPath = join(boardDir(sprint, root), "n1.blocker.md");
        assertTrue(existsSync(blockerPath), "expected a blocker file to be written for the node");
        assertTrue(readFileSync(blockerPath, "utf8").includes(outOfLanePath), "blocker body should reference the attempted out-of-lane path");
        record(id, title, "PASS", "hooks/sage-lane denied the out-of-lane write (permission: deny, agent_message names the violation); the file never landed on disk; board.writeBlocker() produced n1.blocker.md recording the block.");
    }
    catch (e) {
        record(id, title, "FAIL", e.message);
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
}
// ---------------------------------------------------------------------------
// Scenario 5 — Two nodes with overlapping lanes in one wave: /sage-dag
// refuses to present the graph. (The other "one-liner today" from the
// README.)
// ---------------------------------------------------------------------------
function scenario5() {
    const id = "overlapping-lanes";
    const title = "Two nodes with overlapping lanes in one wave";
    try {
        const out = runCli(["dag", "validate", join(FIXTURES, "overlap-dag.json"), "--json"]);
        assertTrue(out.status === 1, `expected dag validate to refuse (exit 1) on overlapping owns globs, got exit ${out.status}`);
        const parsed = JSON.parse(out.stdout);
        const d2 = parsed.violations.filter((v) => v.code === "D2");
        assertTrue(d2.length > 0, `expected at least one D2 (lane overlap) violation, got: ${out.stdout}`);
        record(id, title, "PASS", `sage dag validate evals/fixtures/overlap-dag.json exited 1 with ${d2.length} D2 violation(s) — the graph is refused rather than presented for dispatch.`);
    }
    catch (e) {
        record(id, title, "FAIL", e.message);
    }
}
// ---------------------------------------------------------------------------
// Scenario 6 — Retro run twice on the same problem: second run updates the
// existing learning; no duplicate file.
// ---------------------------------------------------------------------------
function scenario6() {
    const id = "retro-dedup";
    const title = "Retro run twice on the same problem";
    const root = tmpRoot("retro");
    try {
        const docsRoot = join(root, "docs", "learnings");
        mkdirSync(docsRoot, { recursive: true });
        const appliesWhen = "zz-fixture-only: stripe webhook retry storms under load zz";
        const learningPath = join(docsRoot, "stripe-retries.md");
        const bodyV1 = `---\ntitle: Stripe webhook retry storms\nkind: learning\napplies_when: "${appliesWhen}"\n---\n\n# Stripe webhook retry storms\n\nFirst-run learning.\n`;
        writeFileSync(learningPath, bodyV1);
        // "First run": index the fresh learning, then confirm a hypothetical second
        // retro on the same problem WOULD be routed to update-not-duplicate — this
        // is the exact primitive a retro skill calls before deciding to write.
        const idx1 = buildIndex({ docsRoot, skillsRoot: join(root, "no-such-skills-dir") });
        const hits1 = dedupAppliesWhen(idx1, appliesWhen);
        assertTrue(hits1.length === 1, `expected the freshly-written learning to dedup-match itself, got ${hits1.length} hits`);
        assertTrue(hits1[0].path.endsWith("stripe-retries.md"), `expected the match to be stripe-retries.md, got ${hits1[0].path}`);
        // "Second run": a correctly-behaving retro skill sees the dedup hit above and
        // UPDATES the same file rather than creating a new one — simulate exactly
        // that action, then assert no duplicate file exists.
        const bodyV2 = bodyV1.replace("First-run learning.", "First-run learning.\n\nSecond-run update: recurrence confirmed.");
        writeFileSync(learningPath, bodyV2);
        const idx2 = buildIndex({ docsRoot, skillsRoot: join(root, "no-such-skills-dir") });
        assertTrue(idx2.docs.length === 1, `expected exactly one learning doc after the second run, found ${idx2.docs.length}`);
        const finalBody = readFileSync(learningPath, "utf8");
        assertTrue(finalBody.includes("Second-run update"), "expected the existing file to carry the update");
        record(id, title, "PASS", "recall.dedupAppliesWhen() correctly matched the existing learning by applies_when on the simulated second run; updating that file in place (rather than creating a new one) leaves exactly one doc. NOTE: this exercises the dedup primitive and the update-in-place file outcome directly; the /sage-retro skill's own decision to call dedup and act on the hit is agent-level and not exercised here.");
    }
    catch (e) {
        record(id, title, "FAIL", e.message);
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
}
// ---------------------------------------------------------------------------
// Scenario 7 — Ship with a STALE evidence record: suite re-runs; the PR is
// not opened on stale evidence.
// ---------------------------------------------------------------------------
function scenario7() {
    const id = "stale-evidence-ship";
    const title = "Ship with a STALE evidence record";
    const root = tmpRoot("ship");
    try {
        // Record a PASSING run first, then invalidate it by recording a command
        // whose cmd_sha256 will no longer match what ship expects to see checked —
        // the simplest, most direct way to force STALE deterministically without
        // relying on git state (evidence.run tolerates a non-git cwd).
        const good = runCli(["evidence", "run", "--label", "ship", "--", "node", "-e", "process.exit(0)"], { cwd: root });
        assertTrue(good.status === 0, `expected the recorded verify command to succeed, got exit ${good.status}`);
        const check = runCli(["evidence", "check", "--label", "ship", "--expect-cmd", "npm test", "--json"], { cwd: root });
        assertTrue(check.status === 1, `expected evidence check to exit 1 (non-FRESH) on a mismatched/stale record, got ${check.status}`);
        const graded = JSON.parse(check.stdout);
        assertTrue(graded.grade === "STALE", `expected grade STALE, got ${graded.grade}: ${graded.reason}`);
        record(id, title, "PASS", `sage evidence check reported STALE (${graded.reason}) with a non-zero exit — this is the exact gate signal a /sage-ship skill checks before opening a PR. NOTE: this validates the STALE-detection gate itself; whether the ship skill actually refrains from calling \`gh pr create\` on that signal is an agent/git-hosting-level action not exercised by this runner.`);
    }
    catch (e) {
        record(id, title, "FAIL", e.message);
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
}
// ---------------------------------------------------------------------------
// Scenario 8 — Fresh session after /clear mid-sprint: sage board next
// returns the correct action with no history.
// ---------------------------------------------------------------------------
function scenario8() {
    const id = "fresh-session-board-next";
    const title = "Fresh session after /clear mid-sprint";
    const root = tmpRoot("board");
    try {
        const sprint = "eval-s8";
        const ledger = {
            sprint,
            plan: "eval plan",
            base: "main",
            branch: "sage/eval-s8",
            started: new Date().toISOString(),
            waves: [["n1", "n2"]],
            nodes: {
                // n1 was mid-flight when the session got /clear'd; n2 hasn't started.
                n1: { status: "building", attempts: 1, updated: new Date().toISOString() },
                n2: { status: "pending", attempts: 0, updated: new Date().toISOString() },
            },
            rulings: [],
            cost: { laneB: 0, laneCtokens: 0 },
            wtf: 0,
        };
        mkdirSync(dirname(ledgerPath(sprint, root)), { recursive: true });
        writeFileSync(ledgerPath(sprint, root), renderLedger(ledger));
        // Every CLI invocation is a fresh process with zero conversation memory —
        // board.next() reading correct behaviour straight off disk here IS the
        // "no history" proof; there is no session state to lose.
        const action = boardNext(sprint, root);
        assertTrue(action.action === "dispatch", `expected action "dispatch", got ${action.action} (${action.reason})`);
        assertTrue(action.nodes.length === 1 && action.nodes[0] === "n1", `expected to resume exactly the in-flight node n1, got ${JSON.stringify(action.nodes)}`);
        // Also exercise the CLI entrypoint (the actual command a hook/agent runs).
        const cliOut = runCli(["board", "next", "--sprint", sprint, "--json"], { cwd: root });
        assertTrue(cliOut.status === 0, `sage board next exited ${cliOut.status}: ${cliOut.stderr}`);
        const cliAction = JSON.parse(cliOut.stdout);
        assertTrue(cliAction.action === "dispatch" && cliAction.nodes[0] === "n1", `CLI board next disagreed with the library call: ${cliOut.stdout}`);
        record(id, title, "PASS", "board.next() (both as a direct call and via `sage board next`) resumed the in-flight node n1 from the ledger on disk alone — no in-process or session state was involved, which is exactly what a /clear mid-sprint requires.");
    }
    catch (e) {
        record(id, title, "FAIL", e.message);
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
}
// ---------------------------------------------------------------------------
function main() {
    scenario1();
    scenario2();
    scenario3();
    scenario4();
    scenario5();
    scenario6();
    scenario7();
    scenario8();
    const width = Math.max(...results.map((r) => r.title.length));
    let failed = 0;
    for (const r of results) {
        if (r.status === "FAIL")
            failed++;
        const badge = r.status === "PASS" ? "PASS " : r.status === "FAIL" ? "FAIL " : "SKIP ";
        process.stdout.write(`[${badge}] ${r.title.padEnd(width)}  ${r.detail}\n`);
    }
    const pass = results.filter((r) => r.status === "PASS").length;
    const skip = results.filter((r) => r.status === "SKIP").length;
    process.stdout.write(`\n${pass} passed, ${failed} failed, ${skip} skipped (of ${results.length})\n`);
    process.exitCode = failed > 0 ? 1 : 0;
}
main();
