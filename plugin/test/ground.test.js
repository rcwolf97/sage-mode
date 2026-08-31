import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { groundMechanical, reviewDocSkeleton } from "../lib/ground/index.js";
import { refuseTypeCheckOnlyForRuntime, meetsMinimumGrade } from "../lib/evidence/index.js";
function gitInit(dir) {
    spawnSync("git", ["init"], { cwd: dir });
    spawnSync("git", ["config", "user.email", "t@t.t"], { cwd: dir });
    spawnSync("git", ["config", "user.name", "t"], { cwd: dir });
    writeFileSync(join(dir, "real.ts"), "export {}\n");
    spawnSync("git", ["add", "-A"], { cwd: dir });
    spawnSync("git", ["commit", "-m", "init"], { cwd: dir });
}
test("ground flags a missing path and a scaffold leak, and does not flag a real file", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-ground-"));
    gitInit(dir);
    const doc = join(dir, "note.md");
    writeFileSync(doc, [
        "See real.ts for the implementation.",
        "Also missing/not-here.ts:12 is cited.",
        "compound-engineering-plugin/skills/ce-compound/references/agents/*.md",
        "TODO(fill-in) and Learning 3 and {{placeholder}} and <slug>",
        "",
    ].join("\n"));
    const r = groundMechanical(doc, dir);
    const kinds = r.flags.map((f) => f.kind);
    assert.ok(kinds.includes("path"), JSON.stringify(r.flags));
    assert.ok(kinds.includes("scaffold"), JSON.stringify(r.flags));
    assert.ok(r.flags.some((f) => f.text.includes("ce-compound") || f.detail.includes("ce-compound")));
    assert.ok(!r.flags.some((f) => f.text === "real.ts"));
});
test("reviewDocSkeleton is non-rewriting and lists all five rubric dimensions", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-doc-"));
    gitInit(dir);
    const doc = join(dir, "spec.md");
    writeFileSync(doc, "# Spec\n\nSee real.ts.\n");
    const body = reviewDocSkeleton(doc, dir);
    for (const d of ["completeness", "consistency", "clarity", "scope", "feasibility"]) {
        assert.match(body, new RegExp(`### ${d}`));
    }
    assert.match(body, /Non-blocking/);
});
test("refuseTypeCheckOnlyForRuntime rejects type-check-only for runtime acceptance", () => {
    assert.equal(refuseTypeCheckOnlyForRuntime("POST /x returns 401", "type-check-only"), true);
    assert.equal(refuseTypeCheckOnlyForRuntime("POST /x returns 401", "unit-test-verified"), false);
    assert.equal(meetsMinimumGrade({ ts: "", label: "t", command: "c", cmd_sha256: "x", exit: 0, duration_s: 1, grade: "live-verified" }, "unit-test-verified"), true);
    assert.equal(meetsMinimumGrade({ ts: "", label: "t", command: "c", cmd_sha256: "x", exit: 0, duration_s: 1, grade: "type-check-only" }, "unit-test-verified"), false);
});
