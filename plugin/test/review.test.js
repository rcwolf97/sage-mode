import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { gate, dedup, checkRecommendation, SPECIALIST_ROSTER, scope, validateFindingRow, classifyFinding, classifyFix, } from "../lib/review/index.js";
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
// Cross-run suppression ("a fingerprint the user previously marked `skipped`
// is suppressed only if the file hasn't changed since" — skills/sage-review/
// SKILL.md ~line 79) has NO corresponding implementation anywhere in this
// module: `Finding` carries no `status`/`skipped` field, `dedup`/`gate` take
// only a single run's findings array with no notion of a prior run or a
// file-content check, and no other lib exports anything that consults
// lib/evidence's git-tree-hash fingerprinting for this purpose either. The
// rule is real (it's documented as a mechanical pipeline step) but is
// currently enforced by nothing except an LLM reviewer choosing to follow
// the prose — there is no code path to write a unit test against. See the
// final summary for this flagged as a gap rather than fabricated here as a
// test of scaffolding this file doesn't own.
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
test("every specialist in SPECIALIST_ROSTER has a checklist file sage-review/SKILL.md can actually dispatch", () => {
    for (const name of SPECIALIST_ROSTER) {
        const path = join(import.meta.dirname, "..", "skills", "sage-review", "references", "checklists", `${name}.md`);
        assert.ok(existsSync(path), `missing checklist file for specialist "${name}": ${path}`);
    }
});
