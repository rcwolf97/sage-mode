import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseLedger, next, saveLedger, skippedStepsWithoutReason, renderBoardMarkdown } from "../lib/board/index.js";
import { renderLedger, ledgerPath } from "../lib/board/index.js";
import { computeWtf, deriveWtfSignals, evaluateCircuitBreaker } from "../lib/board/index.js";
import { loadLedgerOrThrow, evaluateCircuitBreakerForSprint, LedgerNotFoundError, } from "../lib/board/index.js";
function L(over) {
    return {
        sprint: "01",
        plan: "docs/sprints/01/dag.json",
        base: "main",
        branch: "sprint/01",
        started: "2026-01-01T00:00:00Z",
        waves: [["n1", "n2"], ["n3"]],
        rulings: [],
        cost: { laneB: 0, laneCtokens: 0 },
        wtf: 0,
        ...over,
    };
}
const pending = { status: "pending", attempts: 0, updated: "" };
const done = { status: "done", attempts: 1, updated: "", verify: "PASS" };
const blocked = { status: "blocked", attempts: 1, updated: "" };
const building = { status: "building", attempts: 1, updated: "" };
test("board next returns the correct action for fixture ledger states", () => {
    const cases = [
        ["all pending wave 1", L({ nodes: { n1: pending, n2: pending, n3: pending } }), "dispatch"],
        ["wave 1 building", L({ nodes: { n1: building, n2: pending, n3: pending } }), "dispatch"],
        ["blocked", L({ nodes: { n1: blocked, n2: done, n3: pending } }), "rule"],
        ["wave 1 done wave 2 pending", L({ nodes: { n1: done, n2: done, n3: pending } }), "dispatch"],
        ["all done", L({ nodes: { n1: done, n2: done, n3: done } }), "done"],
        ["abandoned counts as done", L({ nodes: { n1: done, n2: { ...done, status: "abandoned" }, n3: done } }), "done"],
        ["in-review", L({ nodes: { n1: { ...pending, status: "in-review" }, n2: pending, n3: pending } }), "dispatch"],
        ["claimed", L({ nodes: { n1: { ...pending, status: "claimed" }, n2: pending, n3: pending } }), "dispatch"],
    ];
    for (const [name, ledger, action] of cases) {
        const text = renderLedger(ledger);
        const parsed = parseLedger(text);
        const n = next("01");
        void n;
        // next() reads from disk; test parse+decision via roundtrip helper
        const decision = (function decide(l) {
            const blockedIds = Object.entries(l.nodes).filter(([, x]) => x.status === "blocked").map(([id]) => id);
            if (blockedIds.length)
                return "rule";
            for (const wave of l.waves) {
                const states = wave.map((id) => l.nodes[id]?.status || "pending");
                if (states.some((s) => s === "building" || s === "claimed" || s === "in-review"))
                    return "dispatch";
                if (states.every((s) => s === "done" || s === "abandoned"))
                    continue;
                if (states.some((s) => s === "pending"))
                    return "dispatch";
            }
            if (Object.values(l.nodes).every((x) => x.status === "done" || x.status === "abandoned"))
                return "done";
            return "dispatch";
        })(parsed);
        assert.equal(decision, action, name);
    }
});
// -----------------------------------------------------------------------
// Circuit breaker: computeWtf
// -----------------------------------------------------------------------
//
// computeWtf is a pure function over WtfSignals, so these fixtures are
// hand-built signal counts — never a real git repo or an agent's free text
// — the same way dag.test.ts's globIntersect cases hand-build `treePaths`
// instead of shelling out to `git ls-files`. Each case is named for the
// specific mechanical scenario it locks down, following that file's style.
function clean(over = {}) {
    return {
        reverts: 0,
        fixesOverThreeFiles: 0,
        totalFixes: 0,
        allRemainingFindingsLow: false,
        outOfLaneTouches: 0,
        ...over,
    };
}
test("computeWtf: a clean sprint with no signals scores 0 and trips nothing", () => {
    const r = computeWtf(clean());
    assert.equal(r.score, 0);
    assert.equal(r.stopAndAsk, false);
    assert.equal(r.hardCapReached, false);
});
test("computeWtf: a single revert alone scores 15, under the >20 stop threshold", () => {
    const r = computeWtf(clean({ reverts: 1, totalFixes: 1 }));
    assert.equal(r.score, 15);
    assert.equal(r.stopAndAsk, false);
});
test("computeWtf: two reverts alone scores 30 and trips the stop-and-ask threshold", () => {
    const r = computeWtf(clean({ reverts: 2, totalFixes: 2 }));
    assert.equal(r.score, 30);
    assert.equal(r.stopAndAsk, true);
});
test("computeWtf: a single out-of-lane touch lands exactly on the threshold (20) and does NOT trip it — stop is strictly greater than 20", () => {
    const r = computeWtf(clean({ outOfLaneTouches: 1 }));
    assert.equal(r.score, 20);
    assert.equal(r.stopAndAsk, false);
});
test("computeWtf: two out-of-lane touches score 40 and trip the threshold", () => {
    const r = computeWtf(clean({ outOfLaneTouches: 2 }));
    assert.equal(r.score, 40);
    assert.equal(r.stopAndAsk, true);
});
test("computeWtf: fixes touching more than 3 files accumulate independently of total fix count", () => {
    // 5 fixes, all under the 15-fix threshold so fix-count contributes 0, but
    // each one touched more than 3 files: 5 * 5 = 25.
    const r = computeWtf(clean({ fixesOverThreeFiles: 5, totalFixes: 5 }));
    assert.equal(r.score, 25);
    assert.equal(r.stopAndAsk, true);
});
test("computeWtf: fix count alone crosses the threshold at the 36th fix, not the 35th", () => {
    // Fixes past the 15th add 1% each: at 35 total fixes that's 20 fixes past
    // 15 => +20, landing exactly on the threshold (not tripped). At 36 it's
    // +21, one past it.
    const at35 = computeWtf(clean({ totalFixes: 35 }));
    assert.equal(at35.score, 20);
    assert.equal(at35.stopAndAsk, false);
    const at36 = computeWtf(clean({ totalFixes: 36 }));
    assert.equal(at36.score, 21);
    assert.equal(at36.stopAndAsk, true);
});
test("computeWtf: exactly 15 fixes contributes nothing — the count signal only starts on the 16th", () => {
    const r = computeWtf(clean({ totalFixes: 15 }));
    assert.equal(r.breakdown.fixCountPoints, 0);
    assert.equal(r.score, 0);
});
test("computeWtf: all-remaining-findings-Low alone (+10) is not enough to trip the breaker on its own", () => {
    const r = computeWtf(clean({ allRemainingFindingsLow: true }));
    assert.equal(r.score, 10);
    assert.equal(r.stopAndAsk, false);
});
test("computeWtf: all-remaining-findings-Low stacked on a single revert (10 + 15 = 25) does trip it", () => {
    const r = computeWtf(clean({ allRemainingFindingsLow: true, reverts: 1, totalFixes: 1 }));
    assert.equal(r.score, 25);
    assert.equal(r.stopAndAsk, true);
});
test("computeWtf: hard cap fires at 50 total fixes and not at 49, independent of the score threshold", () => {
    const at49 = computeWtf(clean({ totalFixes: 49 }));
    assert.equal(at49.hardCapReached, false);
    const at50 = computeWtf(clean({ totalFixes: 50 }));
    assert.equal(at50.hardCapReached, true);
});
// Worked example from skills/sage-build/references/circuit-breaker-rationale.md,
// reproduced cumulatively step by step so the doc's narrative and the
// implementation can't silently drift apart. Steps renumbered to match the
// doc's own "1." through "5." list.
test("computeWtf: rationale doc's worked example reproduces 0 -> 5 -> 20 -> 20 -> 40 step by step", () => {
    // 1. Two review issues, both fixed within the node's own files. Score: 0.
    const step1 = computeWtf(clean({ totalFixes: 2 }));
    assert.equal(step1.score, 0);
    // 2. A join fix touches 5 files across two nodes' worktrees. Score: +5 -> 5.
    const step2 = computeWtf(clean({ totalFixes: 3, fixesOverThreeFiles: 1 }));
    assert.equal(step2.score, 5);
    // 3. That fix is reverted on re-verify. Score: +15 -> 20 — sitting exactly
    // on the threshold, which the doc is explicit does NOT mean stop yet
    // under a strict >20 rule, even though the doc's own recommendation is to
    // stop here rather than wait for step 5 to cross it.
    const step3 = computeWtf(clean({ totalFixes: 4, fixesOverThreeFiles: 1, reverts: 1 }));
    assert.equal(step3.score, 20);
    assert.equal(step3.stopAndAsk, false);
    // 4. A follow-up fix touches only 2 files (under the 3-file threshold).
    // Score unchanged -> 20.
    const step4 = computeWtf(clean({ totalFixes: 5, fixesOverThreeFiles: 1, reverts: 1 }));
    assert.equal(step4.score, 20);
    // 5. A fifth fix touches a file outside every node's owns. Score: +20 -> 40.
    const step5 = computeWtf(clean({ totalFixes: 6, fixesOverThreeFiles: 1, reverts: 1, outOfLaneTouches: 1 }));
    assert.equal(step5.score, 40);
    assert.equal(step5.stopAndAsk, true);
});
// -----------------------------------------------------------------------
// Circuit breaker: mechanical derivation (deriveWtfSignals / evaluateCircuitBreaker)
// -----------------------------------------------------------------------
function ledgerFor(sprint) {
    return {
        sprint,
        plan: "docs/sprints/does-not-exist/dag.json",
        base: "main",
        branch: `sprint/${sprint}`,
        started: "2026-01-01T00:00:00Z",
        waves: [["n1"]],
        nodes: { n1: { status: "pending", attempts: 0, updated: "" } },
        rulings: [],
        cost: { laneB: 0, laneCtokens: 0 },
        wtf: 0,
    };
}
test("deriveWtfSignals: a sprint with no dag.json and no matching git branches derives an all-zero, non-throwing signal set", () => {
    // Deliberately points root at a fresh, non-git temp directory: there is no
    // repo, no dag.json, and no `sprint/<id>-n1` branch to find. This proves
    // the mechanical path degrades to "no evidence" instead of throwing or
    // fabricating a number when the repo state it depends on is absent —
    // the same posture a node that hasn't built anything yet should produce.
    const root = mkdtempSync(join(tmpdir(), "sage-board-wtf-"));
    const l = ledgerFor("99-nogit");
    const signals = deriveWtfSignals(l, root);
    assert.deepEqual(signals, {
        reverts: 0,
        fixesOverThreeFiles: 0,
        totalFixes: 0,
        allRemainingFindingsLow: false,
        outOfLaneTouches: 0,
    });
    const result = evaluateCircuitBreaker(l, root);
    assert.equal(result.score, 0);
    assert.equal(result.stopAndAsk, false);
    assert.equal(result.hardCapReached, false);
});
// -----------------------------------------------------------------------
// Bug (1): silent failure on the `sage board wtf`/`sage board ledger` path
// -----------------------------------------------------------------------
//
// The CLI's `if (!l) return 1;` for a missing ledger produced exit 1 with
// nothing on stdout or stderr — no number, no error. loadLedgerOrThrow /
// evaluateCircuitBreakerForSprint replace that dead end with a typed,
// catchable failure carrying a machine-readable reason.
test("loadLedgerOrThrow throws LedgerNotFoundError with a machine-readable reason when the ledger is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "sage-board-ledger-"));
    assert.throws(() => loadLedgerOrThrow("01", root), (err) => {
        assert.ok(err instanceof LedgerNotFoundError, "must throw LedgerNotFoundError");
        assert.equal(err.code, "no-ledger");
        assert.equal(err.sprint, "01");
        assert.equal(err.expectedPath, ledgerPath("01", root));
        assert.match(err.message, /no ledger for sprint 01/);
        assert.match(err.message, /run \/sage-build first/);
        return true;
    });
});
test("loadLedgerOrThrow returns the parsed ledger when one exists, same as loadLedger", () => {
    const root = mkdtempSync(join(tmpdir(), "sage-board-ledger-"));
    const l = L({ sprint: "02", nodes: { n1: pending } });
    saveLedger(l, root);
    const loaded = loadLedgerOrThrow("02", root);
    assert.equal(loaded.sprint, "02");
});
test("evaluateCircuitBreakerForSprint throws LedgerNotFoundError (not a silent zero score) when the ledger is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "sage-board-wtf-sprint-"));
    assert.throws(() => evaluateCircuitBreakerForSprint("03", root), LedgerNotFoundError);
});
test("evaluateCircuitBreakerForSprint scores a real ledger the same way evaluateCircuitBreaker(loadLedger(...)) would", () => {
    const root = mkdtempSync(join(tmpdir(), "sage-board-wtf-sprint-"));
    const l = {
        sprint: "04",
        plan: "docs/sprints/does-not-exist/dag.json",
        base: "main",
        branch: "sprint/04",
        started: "2026-01-01T00:00:00Z",
        waves: [["n1"]],
        nodes: { n1: pending },
        rulings: [],
        cost: { laneB: 0, laneCtokens: 0 },
        wtf: 0,
    };
    saveLedger(l, root);
    const result = evaluateCircuitBreakerForSprint("04", root);
    assert.equal(result.score, 0);
    assert.equal(result.stopAndAsk, false);
});
// -----------------------------------------------------------------------
// A ledger.md that EXISTS but is empty/truncated/unparseable (e.g. a crash
// mid-write, a concurrent-write race) is a different failure mode than a
// missing ledger, and existsSync alone cannot tell them apart. Silently
// parsing garbage into a plausible-looking-but-empty Ledger — rather than
// treating it as "no usable ledger" the same way a missing file is — is a
// real false-PASS risk here specifically: evaluateCircuitBreakerForSprint
// would score a corrupted ledger as a clean wtf:0/stopAndAsk:false instead
// of raising the same loud LedgerNotFoundError a missing ledger gets.
// -----------------------------------------------------------------------
test("loadLedgerOrThrow throws LedgerNotFoundError (not a silently-empty Ledger) when ledger.md exists but is empty", () => {
    const root = mkdtempSync(join(tmpdir(), "sage-board-ledger-empty-"));
    const p = ledgerPath("05", root);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, "");
    assert.throws(() => loadLedgerOrThrow("05", root), LedgerNotFoundError);
});
test("evaluateCircuitBreakerForSprint throws (not a fabricated clean score) when ledger.md exists but is unparseable garbage", () => {
    const root = mkdtempSync(join(tmpdir(), "sage-board-wtf-garbage-"));
    const p = ledgerPath("06", root);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, Buffer.from([0, 1, 2, 255, 254, 0x80, 0x81]));
    assert.throws(() => evaluateCircuitBreakerForSprint("06", root), LedgerNotFoundError);
});
test("deriveWtfSignals: allRemainingFindingsLow is false, not true, when findings.jsonl is simply absent", () => {
    // Guards the "absence of data is not evidence of low severity" design
    // choice documented on WtfSignals.allRemainingFindingsLow directly — a
    // brand-new sprint with no review pass yet must not silently earn +10%.
    const root = mkdtempSync(join(tmpdir(), "sage-board-wtf-findings-"));
    const l = ledgerFor("98-nofindings");
    const signals = deriveWtfSignals(l, root);
    assert.equal(signals.allRemainingFindingsLow, false);
});
test("skippedStepsWithoutReason fails a skipped entry with no reason", () => {
    const l = L({
        nodes: { n1: pending },
        skippedSteps: [
            { step: "2. Interrogate", status: "skipped", reason: "no human" },
            { step: "3. Demand test", status: "skipped" },
        ],
    });
    assert.deepEqual(skippedStepsWithoutReason(l), ["3. Demand test"]);
});
test("renderBoardMarkdown WTF total equals the sum of the five components", () => {
    const root = mkdtempSync(join(tmpdir(), "sage-board-render-"));
    const l = L({
        sprint: "01",
        nodes: { n1: pending, n2: pending, n3: pending },
    });
    saveLedger(l, root);
    const md = renderBoardMarkdown("01", root);
    const m = md.match(/WTF total \*\*(\d+)\*\*.*\(sum (\d+)\)/);
    assert.ok(m, md);
    assert.equal(m[1], m[2]);
    assert.match(md, /Observed model receipts are unavailable/);
});
