import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lint } from "./index.js";
// A short but otherwise well-formed SKILL.md (frontmatter + all three required
// sections, disable-model-invocation set). Used as the base for both fixtures below.
const SKILL_MD_HEAD = (name) => `---
name: ${name}
description: Fixture skill for lint floor checks.
disable-model-invocation: true
---

# ${name}
`;
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
function padLines(n) {
    return Array.from({ length: n }, (_, i) => `Line of real procedure content, entry ${i + 1}.`).join("\n") + "\n";
}
test("lint FAILS a stub SKILL.md well under its line floor with an empty references/ dir (previously passed)", () => {
    const root = mkdtempSync(join(tmpdir(), "sage-lint-"));
    const skillDir = join(root, "skills", "stub-skill");
    mkdirSync(skillDir, { recursive: true });
    // references/ is declared (present) but deliberately left empty — the scaffolded-but-
    // never-written signal M8 calls out.
    mkdirSync(join(skillDir, "references"), { recursive: true });
    const body = SKILL_MD_HEAD("stub-skill") + REQUIRED_SECTIONS; // ~20 lines total, well under 25% of the 250-line default cap
    writeFileSync(join(skillDir, "SKILL.md"), body);
    const issues = lint(root);
    const rules = issues.map((i) => i.rule);
    assert.ok(rules.includes("line-floor"), `expected a line-floor issue, got rules: ${rules.join(", ")}`);
    assert.ok(rules.includes("empty-references"), `expected an empty-references issue, got rules: ${rules.join(", ")}`);
    // No other rule should have fired — this fixture is otherwise well-formed, so the
    // failure is attributable specifically to the two new floor checks.
    assert.deepEqual(new Set(rules), new Set(["line-floor", "empty-references"]));
});
test("lint PASSES a substantive SKILL.md with a populated references/ dir", () => {
    const root = mkdtempSync(join(tmpdir(), "sage-lint-"));
    const skillDir = join(root, "skills", "healthy-skill");
    mkdirSync(join(skillDir, "references"), { recursive: true });
    writeFileSync(join(skillDir, "references", "notes.md"), "# Notes\n\nBackground detail loaded on trigger.\n");
    // Comfortably over the 25%-of-250 = 62.5 line floor, comfortably under the 250 cap.
    const body = SKILL_MD_HEAD("healthy-skill") + "\n## Procedure\n\n" + padLines(80) + REQUIRED_SECTIONS;
    writeFileSync(join(skillDir, "SKILL.md"), body);
    const issues = lint(root);
    assert.deepEqual(issues, []);
});
