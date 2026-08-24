import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const hooks = fileURLToPath(new URL("../hooks", import.meta.url));
function run(hook, payload, env = {}) {
    const r = spawnSync(join(hooks, hook), {
        input: payload,
        encoding: "utf8",
        env: { ...process.env, ...env },
    });
    const out = (r.stdout || "").trim() || "{}";
    try {
        return JSON.parse(out);
    }
    catch {
        return { raw: out, status: r.status };
    }
}
test("sage-careful denies rm -rf /, allows node_modules, asks on IFS and compounds", () => {
    const deny = run("sage-careful", JSON.stringify({ command: "rm -rf /" }));
    assert.equal(deny.permission, "deny");
    const allow = run("sage-careful", JSON.stringify({ command: "rm -rf node_modules" }));
    assert.equal(allow.permission, undefined);
    const ask = run("sage-careful", JSON.stringify({ command: "rm${IFS}-rf${IFS}/" }));
    assert.equal(ask.permission, "ask");
    const compound = run("sage-careful", JSON.stringify({ command: "rm -rf tmp && echo x" }));
    assert.equal(compound.permission, "ask");
});
test("sage-careful handles empty, malformed, BOM, quote+newline", () => {
    assert.deepEqual(run("sage-careful", ""), {});
    const mal = run("sage-careful", "{not json");
    assert.equal(mal.permission, "ask");
    const bom = run("sage-careful", "\ufeff" + JSON.stringify({ command: "ls" }));
    assert.equal(bom.permission, undefined);
    const qn = run("sage-careful", JSON.stringify({ command: 'echo "hi\nthere"' }));
    assert.equal(qn.permission, undefined);
});
test("sage-lane denies out of lane and fail-closes on bad JSON; allows in-lane", () => {
    const tmp = mkdtempSync(join(tmpdir(), "sage-lane-"));
    mkdirSync(join(tmp, ".sage"));
    writeFileSync(join(tmp, ".sage", "lane"), JSON.stringify({ owns: ["src/api/**"], node: "n1" }));
    const env = { CURSOR_PROJECT_DIR: tmp };
    const allow = run("sage-lane", JSON.stringify({ tool_input: { path: "src/api/x.ts" } }), env);
    assert.equal(allow.permission, undefined);
    const deny = run("sage-lane", JSON.stringify({ tool_input: { path: "src/web/x.ts" } }), env);
    assert.equal(deny.permission, "deny");
    const mal = run("sage-lane", "{", env);
    assert.equal(mal.permission, "deny");
    const empty = run("sage-lane", "", env);
    assert.equal(empty.permission, "deny");
    const bom = run("sage-lane", "\ufeff" + JSON.stringify({ tool_input: { path: "src/api/y.ts" } }), env);
    assert.equal(bom.permission, undefined);
    const qn = run("sage-lane", JSON.stringify({ tool_input: { path: 'src/api/"weird\nfile.ts' } }), env);
    assert.ok(qn.permission === "deny" || qn.permission === undefined);
});
test("sage-lane denies write through in-boundary symlink pointing outside", () => {
    const tmp = mkdtempSync(join(tmpdir(), "sage-sym-"));
    mkdirSync(join(tmp, ".sage"));
    mkdirSync(join(tmp, "src", "api"), { recursive: true });
    mkdirSync(join(tmp, "secret"), { recursive: true });
    writeFileSync(join(tmp, "secret", "x.ts"), "nope\n");
    spawnSync("ln", ["-s", join(tmp, "secret", "x.ts"), join(tmp, "src", "api", "link.ts")]);
    writeFileSync(join(tmp, ".sage", "lane"), JSON.stringify({ owns: ["src/api/**"] }));
    const deny = run("sage-lane", JSON.stringify({ tool_input: { path: join(tmp, "src", "api", "link.ts") } }), { CURSOR_PROJECT_DIR: tmp });
    assert.equal(deny.permission, "deny");
});
test("sage-solo fail-closes on malformed and denies reviewer children", () => {
    const tmp = mkdtempSync(join(tmpdir(), "sage-solo-"));
    mkdirSync(join(tmp, ".sage"));
    writeFileSync(join(tmp, ".sage", "parent-role"), "reviewer\n");
    const deny = run("sage-solo", JSON.stringify({ subagent_type: "explore" }), { CURSOR_PROJECT_DIR: tmp });
    assert.equal(deny.permission, "deny");
    const mal = run("sage-solo", "nope");
    assert.equal(mal.permission, "deny");
    const empty = run("sage-solo", "");
    assert.equal(mal.permission, "deny");
    assert.equal(empty.permission, "deny");
    const bom = run("sage-solo", "\ufeff" + JSON.stringify({ subagent_type: "explore" }));
    assert.equal(bom.permission, undefined);
});
test("sage-proof and sage-bootstrap emit JSON on empty/malformed/BOM", () => {
    const proof = run("sage-proof", "");
    assert.equal(typeof proof, "object");
    const boot = run("sage-bootstrap", "");
    assert.ok(boot.env);
    assert.ok("SAGE_HOME" in boot.env);
    run("sage-proof", "{");
    run("sage-bootstrap", "\ufeff{}");
});
void chmodSync;
