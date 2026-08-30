// Corpus-wide convention tests. Unlike lib/lint/index.test.ts (which unit-tests
// individual rules against synthetic fixtures), this file has two jobs:
//
//   1. Prove each new rule actually fires — a synthetic fixture with a
//      deliberately injected violation, for every rule below. A convention
//      test that only ever asserts "the real repo is clean" can't tell you
//      whether the check works or whether it's just never running.
//   2. Run every rule against the REAL plugin content and report exactly
//      what's wrong, file and line, so a failure here is a work item, not a
//      puzzle. Skill directories, agent cards, and command files are all
//      enumerated dynamically (readdirSync/walk via lint()) — nothing here
//      hardcodes a list of skill names, so a newly added skill is
//      automatically covered.
//
// Everything here is pure Node: no new dependencies.
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { lint, findDocsRootLiterals } from "../lib/lint/index.js";
const root = resolve(join(import.meta.dirname, ".."));
function issuesFor(rule, issues) {
    return issues.filter((i) => i.rule === rule);
}
function describe(issues) {
    return issues.map((i) => `  ${i.file}: ${i.message}`).join("\n");
}
// A minimal, otherwise-well-formed SKILL.md — same shape as the fixture in
// lib/lint/index.test.ts — so a synthetic-fixture test only trips the one
// rule it's designed to exercise.
const REQUIRED_SECTIONS = `
## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "no time" | still required |

## Red Flags

- nothing implemented yet

## Done when

The checks ran and evidence is cited.
`;
function skillMd(name, extraFrontmatter = "", body = "") {
    return `---
name: ${name}
description: Fixture skill for convention tests.
disable-model-invocation: true
${extraFrontmatter}---

# ${name}

${body}
${REQUIRED_SECTIONS}`;
}
function tmpRoot() {
    return mkdtempSync(join(tmpdir(), "sage-conventions-"));
}
// ---------------------------------------------------------------------------
// (1) REFERENCE INTEGRITY
test("reference-integrity: fires on a SKILL.md that names a references/ file which does not exist", () => {
    const r = tmpRoot();
    const dir = join(r, "skills", "stub");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), skillMd("stub", "", "See `references/missing.md` for the worked example."));
    const issues = issuesFor("reference-integrity", lint(r));
    assert.equal(issues.length, 1, `expected exactly one reference-integrity issue, got:\n${describe(issues)}`);
    assert.match(issues[0].message, /references\/missing\.md/);
});
test("reference-integrity: does not fire on a references/ file that exists, or a resolvable <placeholder> path", () => {
    const r = tmpRoot();
    const dir = join(r, "skills", "stub");
    mkdirSync(join(dir, "references"), { recursive: true });
    writeFileSync(join(dir, "references", "real.md"), "# Real\n");
    mkdirSync(join(r, "profiles"), { recursive: true });
    writeFileSync(join(r, "profiles", "web.json"), "{}");
    writeFileSync(join(dir, "SKILL.md"), skillMd("stub", "", "See `references/real.md`. Profile at `profiles/<profile>.json`, e.g. `profiles/web.json`."));
    const issues = issuesFor("reference-integrity", lint(r));
    assert.deepEqual(issues, []);
});
test("reference-integrity against the real corpus: every references/templates/schemas/profiles/cross-skill path a SKILL.md names resolves", () => {
    const issues = issuesFor("reference-integrity", lint(root));
    assert.deepEqual(issues, [], `broken local references — the target was renamed or never existed:\n${describe(issues)}`);
});
// ---------------------------------------------------------------------------
// (2) SELF-CONTAINMENT
test("self-containment: fires on a skill reaching into another skill's directory outside the references/ allowlist", () => {
    const r = tmpRoot();
    const a = join(r, "skills", "skill-a");
    const b = join(r, "skills", "skill-b");
    mkdirSync(a, { recursive: true });
    mkdirSync(b, { recursive: true });
    writeFileSync(join(a, "SKILL.md"), skillMd("skill-a", "", "Read `skills/skill-b/SKILL.md` directly before starting."));
    writeFileSync(join(b, "SKILL.md"), skillMd("skill-b"));
    const issues = issuesFor("self-containment", lint(r));
    assert.equal(issues.length, 1, `expected exactly one self-containment issue, got:\n${describe(issues)}`);
    assert.match(issues[0].message, /skill-b\/SKILL\.md/);
});
test("self-containment: does not fire on the allowlisted skills/<other>/references/* dispatch form, a glob, or an own-directory reference", () => {
    const r = tmpRoot();
    const a = join(r, "skills", "skill-a");
    const b = join(r, "skills", "skill-b");
    mkdirSync(join(a, "references"), { recursive: true });
    mkdirSync(join(b, "references", "checklists"), { recursive: true });
    writeFileSync(join(b, "references", "checklists", "x.md"), "# X\n");
    writeFileSync(join(a, "references", "own.md"), "# Own\n");
    writeFileSync(join(a, "SKILL.md"), skillMd("skill-a", "", "Pass the path `skills/skill-b/references/checklists/x.md` to the dispatch. Also see `references/own.md` and `skills/skill-a/references/own.md`. Index everything under `skills/**/SKILL.md`."));
    writeFileSync(join(b, "SKILL.md"), skillMd("skill-b"));
    const issues = issuesFor("self-containment", lint(r));
    assert.deepEqual(issues, []);
});
test("self-containment against the real corpus: no skill reaches outside its own directory tree or the shared-asset allowlist", () => {
    const issues = issuesFor("self-containment", lint(root));
    assert.deepEqual(issues, [], `escaping references — outside the skill's own tree and not on the shared allowlist:\n${describe(issues)}`);
});
// ---------------------------------------------------------------------------
// (3) CONDUCT-PARITY
const FIXTURE_CONDUCT = `---
description: Fixture conduct rule. Loaded once. Do not paste it into skills.
alwaysApply: true
---

# Fixture conduct

## Anti-sycophancy

Do not open with agreement. State the strongest objection to the user's position before supporting it.
`;
test("conduct-parity: fires when a skill restates a sage-conduct.mdc normative block instead of citing it", () => {
    const r = tmpRoot();
    mkdirSync(join(r, "rules"), { recursive: true });
    writeFileSync(join(r, "rules", "sage-conduct.mdc"), FIXTURE_CONDUCT);
    const dir = join(r, "skills", "stub");
    mkdirSync(dir, { recursive: true });
    // Appended AFTER the required sections (rather than passed as `body`,
    // which lands before the Common Rationalizations table): the sentence
    // splitter treats an un-punctuated markdown table/list as one run-on
    // "sentence" it can't cleanly bound, so text placed immediately before one
    // gets diluted into a much larger, non-matching block. Real prose in a
    // real SKILL.md doesn't sit directly against a table like that either.
    writeFileSync(join(dir, "SKILL.md"), skillMd("stub") + "\nDo not open with agreement. State the strongest objection to the user's position before supporting it.\n");
    const issues = issuesFor("conduct-parity", lint(r));
    assert.equal(issues.length, 1, `expected exactly one conduct-parity issue, got:\n${describe(issues)}`);
});
test("conduct-parity: does not fire when a skill cites rules/sage-conduct.mdc instead of restating it, or merely shares a topic", () => {
    const r = tmpRoot();
    mkdirSync(join(r, "rules"), { recursive: true });
    writeFileSync(join(r, "rules", "sage-conduct.mdc"), FIXTURE_CONDUCT);
    const dir = join(r, "skills", "stub");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), skillMd("stub", "", "Follow the anti-sycophancy rule from `rules/sage-conduct.mdc` (not restated here). Separately, be skeptical of user claims in general — a loosely related sentiment, not the rule's wording."));
    const issues = issuesFor("conduct-parity", lint(r));
    assert.deepEqual(issues, []);
});
test("conduct-parity against the real corpus: no SKILL.md restates a rules/sage-conduct.mdc heading or a near-duplicate 2+ sentence normative block", () => {
    const issues = issuesFor("conduct-parity", lint(root));
    assert.deepEqual(issues, [], `rules/sage-conduct.mdc says "Do not paste it into skills" — these skills paste it anyway:\n${describe(issues)}`);
});
// ---------------------------------------------------------------------------
// (5) FRONTMATTER VALIDITY
test("frontmatter-validity: fires on a SKILL.md name/directory mismatch, a missing agent name, and a commands/*.md with no description", () => {
    const r = tmpRoot();
    const dir = join(r, "skills", "real-dir-name");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), skillMd("wrong-name"));
    mkdirSync(join(r, "agents"), { recursive: true });
    writeFileSync(join(r, "agents", "reviewer.md"), "---\ndescription: An agent with no name field.\nlane: A\n---\nBody.\n");
    mkdirSync(join(r, "commands"), { recursive: true });
    writeFileSync(join(r, "commands", "do-thing.md"), "---\nname: do-thing\n---\nInvoke the `real-dir-name` skill.\n");
    const issues = issuesFor("frontmatter-validity", lint(r));
    assert.ok(issues.some((i) => i.file.endsWith("skills/real-dir-name/SKILL.md") && /does not match its directory/.test(i.message)), `expected a SKILL.md name/directory mismatch, got:\n${describe(issues)}`);
    assert.ok(issues.some((i) => i.file.endsWith("agents/reviewer.md") && /missing `name`/.test(i.message)), `expected a missing-name issue for the agent card, got:\n${describe(issues)}`);
    assert.ok(issues.some((i) => i.file.endsWith("commands/do-thing.md") && /missing or empty `description`/.test(i.message)), `expected a missing-description issue for the command, got:\n${describe(issues)}`);
});
test("frontmatter-validity against the real corpus: every SKILL.md name matches its directory, every agent/command name matches its filename, every description is non-empty", () => {
    const issues = issuesFor("frontmatter-validity", lint(root));
    assert.deepEqual(issues, [], `frontmatter drift:\n${describe(issues)}`);
});
// ---------------------------------------------------------------------------
// (6) ROSTER/CHECKLIST COVERAGE
test("roster-checklist-coverage: fires on a specialist with no checklist file AND a checklist file nothing references", () => {
    const r = tmpRoot();
    const reviewDir = join(r, "skills", "sage-review");
    mkdirSync(join(reviewDir, "references", "checklists"), { recursive: true });
    writeFileSync(join(reviewDir, "references", "checklists", "orphan.md"), "# Orphan checklist\n");
    writeFileSync(join(reviewDir, "SKILL.md"), skillMd("sage-review", "", "| Specialist | Dispatched when |\n|---|---|\n| ghost-specialist | always |\n\nDispatch with `references/checklists/ghost-specialist.md`."));
    const issues = issuesFor("roster-checklist-coverage", lint(r));
    assert.ok(issues.some((i) => /"ghost-specialist" is referenced/.test(i.message)), `expected a missing-checklist issue for ghost-specialist, got:\n${describe(issues)}`);
    assert.ok(issues.some((i) => /"orphan\.md" exists but is not referenced/.test(i.message)), `expected an orphaned-checklist issue for orphan.md, got:\n${describe(issues)}`);
});
test("roster-checklist-coverage against the real corpus: every specialist named in skills/sage-review/ has a checklist, and every checklist file is referenced", () => {
    const issues = issuesFor("roster-checklist-coverage", lint(root));
    assert.deepEqual(issues, [], `roster/checklist drift in skills/sage-review/:\n${describe(issues)}`);
});
// ---------------------------------------------------------------------------
// (7) COMMAND/SKILL PAIRING
test("command-skill-pairing: fires on a command invoking a nonexistent skill AND a non-catalog skill with no command", () => {
    const r = tmpRoot();
    mkdirSync(join(r, "commands"), { recursive: true });
    writeFileSync(join(r, "commands", "ghost.md"), "---\nname: ghost\ndescription: Invokes a skill that does not exist.\n---\nInvoke the `nonexistent-skill` skill.\n");
    const dir = join(r, "skills", "uncommanded");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), skillMd("uncommanded"));
    const issues = issuesFor("command-skill-pairing", lint(r));
    assert.ok(issues.some((i) => i.file.endsWith("commands/ghost.md") && /nonexistent-skill/.test(i.message)), `expected a broken-target issue for commands/ghost.md, got:\n${describe(issues)}`);
    assert.ok(issues.some((i) => i.file.endsWith("skills/uncommanded/SKILL.md")), `expected an uncommanded-skill issue for skills/uncommanded, got:\n${describe(issues)}`);
});
test("command-skill-pairing: does not fire on a skill in the SUPPORT_SKILLS allowlist even with commands/ present", () => {
    const r = tmpRoot();
    mkdirSync(join(r, "commands"), { recursive: true });
    writeFileSync(join(r, "commands", "noop.md"), "---\nname: noop\ndescription: Placeholder so commands/ exists.\n---\nInvoke the `noop` skill.\n");
    mkdirSync(join(r, "skills", "noop"), { recursive: true });
    writeFileSync(join(r, "skills", "noop", "SKILL.md"), skillMd("noop"));
    mkdirSync(join(r, "skills", "sage-recall"), { recursive: true });
    writeFileSync(join(r, "skills", "sage-recall", "SKILL.md"), skillMd("sage-recall"));
    const issues = issuesFor("command-skill-pairing", lint(r));
    assert.deepEqual(issues, []);
});
test("command-skill-pairing against the real corpus: every command's target skill exists, and every non-catalog skill has a command or is an allowlisted support skill", () => {
    const issues = issuesFor("command-skill-pairing", lint(root));
    assert.deepEqual(issues, [], `command/skill pairing drift:\n${describe(issues)}`);
});
// ---------------------------------------------------------------------------
// (4) NOTEBOOK-ROOT LITERALS
//
// findDocsRootLiterals is exported but deliberately not wired into lint() —
// see the comment on it in lib/lint/index.ts for why. Driven here against an
// allowlist of today's known offenders (test/notebook-root-allowlist.txt)
// instead of a hard zero, so the suite is green now and the count can be
// driven down by whichever agent owns skill content, one line at a time.
function loadAllowlist() {
    const raw = readFileSync(join(import.meta.dirname, "notebook-root-allowlist.txt"), "utf8");
    return raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
        .map((l) => {
        const i = l.indexOf(": ");
        if (i < 0)
            throw new Error(`malformed notebook-root-allowlist.txt line (expected "<file>: <literal>"): ${l}`);
        return { file: l.slice(0, i), literal: l.slice(i + 2) };
    });
}
test("notebook-root-literal: fires on a hardcoded docs/roadmap.md or docs/sprints/NN… path", () => {
    const r = tmpRoot();
    const dir = join(r, "skills", "stub");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), skillMd("stub", "", "Read `docs/roadmap.md`, then write `docs/sprints/NN-<slug>/spec.md`."));
    const issues = findDocsRootLiterals(r);
    const literals = issues.map((i) => i.message);
    assert.equal(issues.length, 2, `expected exactly two distinct literals, got:\n${describe(issues)}`);
    assert.ok(literals.some((m) => m.includes("docs/roadmap.md")));
    assert.ok(literals.some((m) => m.includes("docs/sprints/NN-<slug>/spec.md")));
});
test("notebook-root-literal against the real corpus: every hardcode is on the allowlist, and every allowlist line still matches a real hardcode", () => {
    const allowlist = loadAllowlist();
    const allowlistKeys = new Set(allowlist.map((e) => `${e.file}: ${e.literal}`));
    const actual = findDocsRootLiterals(root);
    const actualKeys = new Set(actual.map((i) => {
        const m = i.message.match(/hardcodes `([^`]+)`/);
        return `${i.file}: ${m ? m[1] : "?"}`;
    }));
    const notAllowlisted = [...actualKeys].filter((k) => !allowlistKeys.has(k));
    assert.deepEqual(notAllowlisted, [], `NEW hardcoded docs/-rooted notebook path(s) not in test/notebook-root-allowlist.txt — either fix the prose to stop hardcoding the root, or (only if genuinely a new, deliberate literal) add a line:\n  ${notAllowlisted.join("\n  ")}`);
    const stale = [...allowlistKeys].filter((k) => !actualKeys.has(k));
    assert.deepEqual(stale, [], `test/notebook-root-allowlist.txt has line(s) that no longer match an actual hardcode — the fix landed, delete the stale line(s) so the list keeps shrinking:\n  ${stale.join("\n  ")}`);
});
