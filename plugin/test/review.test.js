import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { gate, dedup, checkRecommendation, SPECIALIST_ROSTER, scope, validateFindingRow, classifyFinding, classifyFix, applyCrossRunDedup, looksLikeCommandOutput, } from "../lib/review/index.js";
test("review gate caps confidence at 5 when evidence is empty even if input claims 9", () => {
    const out = gate([
        {
            severity: "HIGH",
            confidence: 9,
            path: "src/a.ts",
            category: "security",
            summary: "maybe",
            evidence: "",
            specialist: "security",
        },
    ]);
    assert.equal(out[0].confidence, 5);
});
test("review dedup boosts a two-specialist match by exactly 1 and caps at 10", () => {
    const a = {
        severity: "HIGH",
        confidence: 8,
        path: "src/a.ts",
        line: 1,
        category: "security",
        summary: "x",
        evidence: "const x = 1",
        specialist: "security",
    };
    const b = { ...a, specialist: "correctness", confidence: 7 };
    const out = dedup([a, b]);
    assert.equal(out.length, 1);
    assert.equal(out[0].confidence, 9);
    const cap = { ...a, confidence: 10, specialist: "security" };
    const cap2 = { ...a, confidence: 10, specialist: "testing" };
    const out2 = dedup([cap, cap2]);
    assert.equal(out2[0].confidence, 10);
});
test("checkRecommendation fails when the section is missing entirely", () => {
    const md = `## Findings (≥7)\n\nsomething here\n\n## Residuals\n\nnone\n`;
    const out = checkRecommendation(md);
    assert.equal(out.ok, false);
    assert.ok(out.issues.some((i) => i.includes("missing ## Recommendation section")));
});
test("checkRecommendation fails on a generic hedge with no file:line citation", () => {
    const md = `## Residuals\n\nnone\n\n## Recommendation\n\nProceed with caution, no major issues.\n`;
    const out = checkRecommendation(md);
    assert.equal(out.ok, false);
    assert.ok(out.issues.some((i) => i.includes("does not cite a specific file:line")));
    assert.ok(out.issues.some((i) => i.includes("generic hedge")));
});
test("checkRecommendation passes a generic hedge that still cites a specific file:line", () => {
    // Boilerplate phrasing alongside a real citation is fine — the citation is
    // what carries the "why"; pure boilerplate with nothing specific is not.
    const md = `## Residuals\n\nnone\n\n## Recommendation\n\nProceed with caution because src/auth/login.ts:142 concatenates raw user input into the query.\n`;
    const out = checkRecommendation(md);
    assert.equal(out.ok, true);
    assert.deepEqual(out.issues, []);
});
test("checkRecommendation passes a well-formed recommendation with a real finding citation", () => {
    const md = `## Findings (≥7)\n\nSQL injection in login handler.\n\n## Residuals\n\nnone\n\n## Recommendation\n\nFix before merging because src/auth/login.ts:142 concatenates raw user input into the query.\n`;
    const out = checkRecommendation(md);
    assert.equal(out.ok, true);
    assert.deepEqual(out.issues, []);
});
// Near-miss fingerprint case: same path and category, but a genuinely
// different line number. The fingerprint format is `{path}:{line}:{category}`
// specifically so two distinct real issues that happen to share a file and a
// category don't collapse into one — losing the second issue outright.
test("review dedup keeps two findings separate when only the line number differs (near-miss, not a real duplicate)", () => {
    const a = {
        severity: "HIGH",
        confidence: 8,
        path: "src/a.ts",
        line: 10,
        category: "security",
        summary: "SQL injection risk",
        evidence: "const q = ...",
        specialist: "security",
    };
    const b = { ...a, line: 11 };
    const out = dedup([a, b]);
    assert.equal(out.length, 2);
});
// Same path/line/category but a completely reworded summary and different
// evidence text. dedup must key purely on the fingerprint's path/line/category
// fields, not on exact text match — otherwise two specialists independently
// wording the same real issue differently would both survive as "duplicates"
// instead of merging into one.
test("review dedup merges two findings at the same path:line:category even when the summary text is completely reworded", () => {
    const a = {
        severity: "HIGH",
        confidence: 6,
        path: "src/x.ts",
        line: 20,
        category: "correctness",
        summary: "Off-by-one error in the loop bound",
        evidence: "for (i=0;i<=n;i++)",
        specialist: "correctness",
    };
    const b = {
        ...a,
        summary: "Loop condition allows one extra iteration past the array end",
        evidence: "i <= n should be i < n",
        confidence: 9,
    };
    const out = dedup([a, b]);
    assert.equal(out.length, 1);
    assert.equal(out[0].confidence, 9);
});
test("gate demotes rung >= 4 without command-output evidence to 3 and caps confidence at 5", () => {
    const out = gate([
        {
            severity: "HIGH",
            confidence: 9,
            path: "src/a.ts",
            category: "correctness",
            summary: "fails at runtime",
            evidence: "I ran it in my head",
            specialist: "correctness",
            rung: 4,
        },
    ]);
    assert.equal(out[0].rung, 3);
    assert.equal(out[0].confidence, 5);
});
test("gate keeps rung 4 when evidence looks like command output", () => {
    const out = gate([
        {
            severity: "HIGH",
            confidence: 8,
            path: "src/a.ts",
            category: "correctness",
            summary: "fails at runtime",
            evidence: "```\n$ npm test\nnot ok\n```",
            specialist: "correctness",
            rung: 4,
        },
    ]);
    assert.equal(out[0].rung, 4);
    assert.equal(out[0].confidence, 8);
});
test("looksLikeCommandOutput accepts fences and prompt markers", () => {
    assert.equal(looksLikeCommandOutput("```\nok\n```"), true);
    assert.equal(looksLikeCommandOutput("$ npm test"), true);
    assert.equal(looksLikeCommandOutput("just a sentence"), false);
});
test("applyCrossRunDedup suppresses skipped fingerprints only when the file hash is unchanged; never suppresses fixed", () => {
    const skipped = {
        severity: "NITPICK",
        confidence: 6,
        path: "src/a.ts",
        category: "style",
        summary: "naming",
        specialist: "maintainability",
        fingerprint: "src/a.ts:style",
    };
    const state = {
        "src/a.ts:style": { fingerprint: "src/a.ts:style", disposition: "skipped", hash: "aaa" },
        "src/b.ts:bug": { fingerprint: "src/b.ts:bug", disposition: "fixed", hash: "bbb" },
    };
    const hashes = { "src/a.ts": "aaa", "src/b.ts": "bbb" };
    const fileHash = (p) => hashes[p];
    const dropped = applyCrossRunDedup([skipped], state, fileHash);
    assert.equal(dropped.length, 0);
    hashes["src/a.ts"] = "changed";
    const kept = applyCrossRunDedup([skipped], state, fileHash);
    assert.equal(kept.length, 1);
    const fixed = { ...skipped, path: "src/b.ts", fingerprint: "src/b.ts:bug" };
    const neverDrop = applyCrossRunDedup([fixed], state, fileHash);
    assert.equal(neverDrop.length, 1);
});
test("checkRecommendation fails when the section exists but is empty", () => {
    const md = `## Residuals\n\nnone\n\n## Recommendation\n\n## Not-a-real-heading-but-lowercase-so-ignored\n`;
    const out = checkRecommendation(md);
    assert.equal(out.ok, false);
    assert.ok(out.issues.some((i) => i.includes("empty")));
});
// -----------------------------------------------------------------------
// Bug (3): review scope polluted by sage-mode's own artifacts
// -----------------------------------------------------------------------
//
// Reproduced: `sage review scope --base HEAD` picked up
// .sage/sprints/00/evidence.jsonl, .sage/sprints/00/logs/tests-*.log, and
// .worktrees/s01-n1/ as "changed files," none of which matched any SCOPE_*
// category, tripping SCOPE_ERROR=unmatched (exit 2) — which the skill
// escalates to the user as a classifier bug even though sage's own scratch
// output caused it. This repo mixes real source changes with sage scratch
// in every shape the bug report named: an untracked evidence.jsonl and log
// file, an untracked worktree checkout, and — the sharper case — a
// previously (accidentally) committed evidence.jsonl that then gets
// modified, so it would also show up in the committed-diff numstat, not
// just the untracked-file listing.
function gitInit(dir) {
    spawnSync("git", ["init"], { cwd: dir });
    spawnSync("git", ["config", "user.email", "t@t.t"], { cwd: dir });
    spawnSync("git", ["config", "user.name", "t"], { cwd: dir });
}
test("review scope excludes .sage/ and .worktrees/ from files and DIFF_LINES, so a repo with both real changes and sage scratch reports only the real ones (no SCOPE_ERROR)", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-review-scope-"));
    gitInit(dir);
    mkdirSync(join(dir, "src", "api"), { recursive: true });
    writeFileSync(join(dir, "src", "api", "handler.ts"), "export const a = 1;\n");
    // A sage evidence.jsonl that was (wrongly) committed once, so a later edit
    // to it shows up in the *committed* diff, not just as an untracked file —
    // exercising the --numstat exclusion path, not only the file-list one.
    mkdirSync(join(dir, ".sage", "sprints", "00"), { recursive: true });
    writeFileSync(join(dir, ".sage", "sprints", "00", "evidence.jsonl"), '{"label":"old"}\n');
    spawnSync("git", ["add", "-A"], { cwd: dir });
    spawnSync("git", ["commit", "-m", "init"], { cwd: dir });
    // Real source change.
    writeFileSync(join(dir, "src", "api", "handler.ts"), "export const a = 2;\nexport const b = 3;\n");
    // Modify the already-tracked evidence.jsonl (committed diff).
    writeFileSync(join(dir, ".sage", "sprints", "00", "evidence.jsonl"), '{"label":"old"}\n{"label":"new"}\n');
    // Untracked sage scratch: a fresh log file and a node worktree checkout —
    // exactly the shapes the bug report named.
    mkdirSync(join(dir, ".sage", "sprints", "00", "logs"), { recursive: true });
    writeFileSync(join(dir, ".sage", "sprints", "00", "logs", "tests-abc.log"), "log output\n");
    mkdirSync(join(dir, ".worktrees", "s01-n1"), { recursive: true });
    writeFileSync(join(dir, ".worktrees", "s01-n1", "scratch.txt"), "worktree checkout\n");
    const s = scope({ base: "HEAD", cwd: dir });
    assert.equal(s.error, undefined, `expected no SCOPE_ERROR, got ${s.error}`);
    assert.deepEqual(s.files, ["src/api/handler.ts"]);
    assert.ok(!s.files.some((f) => f.startsWith(".sage/") || f.startsWith(".worktrees/")), "files must not include any .sage/ or .worktrees/ path");
    assert.ok(s.SCOPE_BACKEND, "src/api/handler.ts should still classify as backend scope");
    // DIFF_LINES must come only from the real file's numstat row (2 added, 1
    // removed = 3), not from evidence.jsonl's own +1/-0 committed-diff row.
    assert.equal(s.DIFF_LINES, 3);
});
// -----------------------------------------------------------------------
// Bug (4): finding rows are validated at the gate
// -----------------------------------------------------------------------
//
// architecture-v3 §8.3 claims the finding shape is enforced "at the tool
// layer," which is only true for the Lane B `claude -p --json-schema` path —
// Lane C subagents have nothing analogous, so malformed JSONL from a broken
// specialist flowed straight through gate() into a "clean" result. These
// tests pin the fix: gate() now rejects malformed rows with a reason
// (attached, not lost) instead of coercing or silently dropping them.
const validFinding = () => ({
    severity: "HIGH",
    confidence: 8,
    path: "src/a.ts",
    line: 10,
    category: "security",
    summary: "issue",
    evidence: "const x = 1",
    specialist: "security",
});
test("validateFindingRow rejects a row missing a required field, with a reason naming the field", () => {
    const row = validFinding();
    delete row.severity;
    const v = validateFindingRow(row);
    assert.equal(v.ok, false);
    assert.match(v.reason, /severity/);
});
test("validateFindingRow rejects an out-of-range confidence instead of silently clamping it", () => {
    const v = validateFindingRow({ ...validFinding(), confidence: 47 });
    assert.equal(v.ok, false);
    assert.match(v.reason, /confidence/);
});
test("validateFindingRow rejects a non-integer confidence instead of silently rounding it", () => {
    const v = validateFindingRow({ ...validFinding(), confidence: 8.5 });
    assert.equal(v.ok, false);
    assert.match(v.reason, /confidence/);
});
test("validateFindingRow rejects an invalid severity", () => {
    const v = validateFindingRow({ ...validFinding(), severity: "LOW" });
    assert.equal(v.ok, false);
    assert.match(v.reason, /severity/);
});
test("validateFindingRow accepts a well-formed row", () => {
    const v = validateFindingRow(validFinding());
    assert.equal(v.ok, true);
});
test("gate() rejects malformed rows with a reason instead of dropping them silently or letting them through as a clean bill of health", () => {
    const good = validFinding();
    const missingField = { ...validFinding() };
    delete missingField.path;
    const badConfidence = { ...validFinding(), confidence: 99 };
    const out = gate([good, missingField, badConfidence]);
    assert.equal(out.length, 1, "only the well-formed row should be accepted");
    assert.equal(out[0].path, "src/a.ts");
    assert.equal(out.rejected.length, 2, "both malformed rows must be reported, not dropped");
    assert.ok(out.rejected.some((r) => r.reason.includes("path")));
    assert.ok(out.rejected.some((r) => r.reason.includes("confidence")));
});
test("gate() still behaves exactly as before for well-formed input (indexable Finding[], toJsonl/JSON.stringify-compatible)", () => {
    const out = gate([validFinding()]);
    assert.equal(out.length, 1);
    assert.equal(out[0].confidence, 8);
    assert.deepEqual(JSON.parse(JSON.stringify(out)), [
        { ...validFinding(), fingerprint: "src/a.ts:10:security" },
    ]);
});
// -----------------------------------------------------------------------
// Bug (5): the "cannot verify from the diff" verdict
// -----------------------------------------------------------------------
test("cannot_verify findings are not gate-capped for missing evidence", () => {
    const f = { ...validFinding(), confidence: 9, evidence: "", cannot_verify: true };
    const out = gate([f]);
    assert.equal(out[0].confidence, 9, "confidence must not be capped at 5 just because evidence is empty");
});
test("an ordinary (non-cannot_verify) finding with empty evidence is still capped at 5, unchanged", () => {
    const f = { ...validFinding(), confidence: 9, evidence: "" };
    const out = gate([f]);
    assert.equal(out[0].confidence, 5);
});
test("cannot_verify findings survive dedup, and the flag propagates even when merged under a higher-confidence duplicate that didn't set it", () => {
    const a = { ...validFinding(), specialist: "security", confidence: 8, cannot_verify: true };
    const b = { ...validFinding(), specialist: "correctness", confidence: 9, cannot_verify: false };
    const out = dedup([a, b]);
    assert.equal(out.length, 1);
    assert.equal(out[0].cannot_verify, true);
});
test("classifyFinding routes cannot_verify findings to their own outcome regardless of confidence", () => {
    const high = { ...validFinding(), confidence: 9, cannot_verify: true };
    const low = { ...validFinding(), confidence: 2, cannot_verify: true };
    assert.equal(classifyFinding(high), "cannot_verify");
    assert.equal(classifyFinding(low), "cannot_verify");
    const normal = { ...validFinding(), confidence: 9 };
    assert.equal(classifyFinding(normal), "show");
});
test("classifyFix always asks a human for a cannot_verify finding, never auto-fixes", () => {
    const f = { ...validFinding(), severity: "NITPICK", cannot_verify: true };
    assert.equal(classifyFix(f), "ASK");
});
// sage-review/SKILL.md step 3 tells the dispatcher to pass a checklist
// *path* — skills/sage-review/references/checklists/<specialist>.md — for
// every name `select()` can return. SPECIALIST_ROSTER is the single source
// of truth for those names (select()'s opts.all branch iterates it directly,
// see lib/review/index.ts). If a name is ever added to the roster without a
// matching checklist file landing alongside it, the dispatch instruction
// silently breaks — the agent would be told to pass a path that 404s. This
// test makes that drift a build-time failure instead of a runtime surprise
// discovered mid-review.
// -----------------------------------------------------------------------
// dedup() calls gate() internally (to key/merge only well-formed rows) but
// must not silently swallow the rejection info gate() already computed.
// `sage review gate` surfaces `.rejected` and flips its exit code non-zero
// on a malformed row (see test/cli.test.ts); `sage review dedup` — the very
// next stage of the same pipeline (skills/sage-review/SKILL.md step 5: gate
// -> dedup) — must not be a laundering step that turns "N rows rejected"
// back into an invisible, silently-dropped clean bill of health for any
// caller that goes through dedup()'s return value directly.
// -----------------------------------------------------------------------
test("dedup() surfaces rejected rows via .rejected, the same way gate() does, instead of silently dropping them", () => {
    const good = {
        severity: "HIGH",
        confidence: 8,
        path: "src/a.ts",
        line: 1,
        category: "security",
        summary: "real finding",
        evidence: "src/a.ts:1",
        specialist: "security",
    };
    const malformed = { ...good, severity: "SUPER-BAD" };
    const out = dedup([good, malformed]);
    assert.equal(out.length, 1, "only the well-formed row should survive dedup");
    assert.equal(out[0].path, "src/a.ts");
    assert.ok(out.rejected, ".rejected must be present on dedup()'s return, not undefined");
    assert.equal(out.rejected.length, 1, "the malformed row must be reported, not dropped without a trace");
    assert.match(out.rejected[0].reason, /severity/i);
});
test("every specialist in SPECIALIST_ROSTER has a checklist file sage-review/SKILL.md can actually dispatch", () => {
    for (const name of SPECIALIST_ROSTER) {
        const path = join(import.meta.dirname, "..", "skills", "sage-review", "references", "checklists", `${name}.md`);
        assert.ok(existsSync(path), `missing checklist file for specialist "${name}": ${path}`);
    }
});
