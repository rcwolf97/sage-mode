import assert from "node:assert/strict";
import test from "node:test";
import { gate, dedup, checkRecommendation, type Finding } from "../lib/review/index.js";

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
  assert.equal(out[0]!.confidence, 5);
});

test("review dedup boosts a two-specialist match by exactly 1 and caps at 10", () => {
  const a: Finding = {
    severity: "HIGH",
    confidence: 8,
    path: "src/a.ts",
    line: 1,
    category: "security",
    summary: "x",
    evidence: "const x = 1",
    specialist: "security",
  };
  const b: Finding = { ...a, specialist: "correctness", confidence: 7 };
  const out = dedup([a, b]);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.confidence, 9);
  const cap: Finding = { ...a, confidence: 10, specialist: "security" };
  const cap2: Finding = { ...a, confidence: 10, specialist: "testing" };
  const out2 = dedup([cap, cap2]);
  assert.equal(out2[0]!.confidence, 10);
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
  const a: Finding = {
    severity: "HIGH",
    confidence: 8,
    path: "src/a.ts",
    line: 10,
    category: "security",
    summary: "SQL injection risk",
    evidence: "const q = ...",
    specialist: "security",
  };
  const b: Finding = { ...a, line: 11 };
  const out = dedup([a, b]);
  assert.equal(out.length, 2);
});

// Same path/line/category but a completely reworded summary and different
// evidence text. dedup must key purely on the fingerprint's path/line/category
// fields, not on exact text match — otherwise two specialists independently
// wording the same real issue differently would both survive as "duplicates"
// instead of merging into one.
test("review dedup merges two findings at the same path:line:category even when the summary text is completely reworded", () => {
  const a: Finding = {
    severity: "HIGH",
    confidence: 6,
    path: "src/x.ts",
    line: 20,
    category: "correctness",
    summary: "Off-by-one error in the loop bound",
    evidence: "for (i=0;i<=n;i++)",
    specialist: "correctness",
  };
  const b: Finding = {
    ...a,
    summary: "Loop condition allows one extra iteration past the array end",
    evidence: "i <= n should be i < n",
    confidence: 9,
  };
  const out = dedup([a, b]);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.confidence, 9);
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
