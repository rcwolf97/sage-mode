import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const hooks = fileURLToPath(new URL("../hooks", import.meta.url));

function run(hook: string, payload: string, env: Record<string, string> = {}) {
  const r = spawnSync(join(hooks, hook), {
    input: payload,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  const out = (r.stdout || "").trim() || "{}";
  try {
    return JSON.parse(out);
  } catch {
    return { raw: out, status: r.status };
  }
}

// runAsClaude: same as run(), but forces SAGE_HOST=claude via
// CLAUDE_PROJECT_DIR (host-detect.sh checks CURSOR_* first, so those are
// explicitly cleared too, in case the ambient test environment happens to
// have one set) and returns the exit status alongside the parsed JSON —
// needed to assert emit_deny's documented exit-2-on-Claude-Code contract,
// which run()'s return value alone doesn't expose on the success path.
function runAsClaude(hook: string, payload: string, tmp: string) {
  const r = spawnSync(join(hooks, hook), {
    input: payload,
    encoding: "utf8",
    env: {
      ...process.env,
      CURSOR_PLUGIN_ROOT: "",
      CURSOR_PROJECT_DIR: "",
      CLAUDE_PLUGIN_ROOT: "",
      CLAUDE_PROJECT_DIR: tmp,
    },
  });
  const out = (r.stdout || "").trim() || "{}";
  let json: unknown;
  try {
    json = JSON.parse(out);
  } catch {
    json = { raw: out };
  }
  return { json: json as Record<string, any>, status: r.status };
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
  const deny = run(
    "sage-lane",
    JSON.stringify({ tool_input: { path: join(tmp, "src", "api", "link.ts") } }),
    { CURSOR_PROJECT_DIR: tmp },
  );
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

// --- Claude Code host shape (SAGE_HOST=claude via CLAUDE_PROJECT_DIR) ---
// Mirrors the golden-fixture matrix in hooks/tests/ (every *.claude.out.json
// there is the same emit_deny/emit_ask/emit_allow/emit_followup contract
// asserted here), kept in this TypeScript suite too since test/hooks.test.ts
// is the file `npm test` actually runs, not just `hooks/tests/run.sh`.

test("sage-careful emits Claude Code deny/ask shape and exits 2 on deny", () => {
  const tmp = mkdtempSync(join(tmpdir(), "sage-careful-claude-"));
  const deny = runAsClaude("sage-careful", JSON.stringify({ command: "rm -rf /" }), tmp);
  assert.equal(deny.json.hookSpecificOutput?.permissionDecision, "deny");
  assert.equal(deny.json.decision, "block");
  assert.equal(typeof deny.json.reason, "string");
  assert.equal(deny.status, 2, "emit_deny must exit 2 on Claude Code");

  const ask = runAsClaude("sage-careful", JSON.stringify({ command: "rm -rf tmp && echo x" }), tmp);
  assert.equal(ask.json.hookSpecificOutput?.permissionDecision, "ask");
  assert.equal(ask.json.decision, undefined, "ask has no legacy decision/reason shape to double up");
  assert.equal(ask.status, 0);

  const allow = runAsClaude("sage-careful", JSON.stringify({ command: "ls" }), tmp);
  assert.deepEqual(allow.json, {});
  assert.equal(allow.status, 0);

  // Also via Claude Code's real matcher: Bash tool, path under tool_input.command.
  const viaToolInput = runAsClaude(
    "sage-careful",
    JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "rm -rf /" } }),
    tmp,
  );
  assert.equal(viaToolInput.json.hookSpecificOutput?.permissionDecision, "deny");
  assert.equal(viaToolInput.status, 2);
});

test("sage-lane emits Claude Code deny shape (exit 2) and allow, and finds tool_input.file_path", () => {
  const tmp = mkdtempSync(join(tmpdir(), "sage-lane-claude-"));
  mkdirSync(join(tmp, ".sage"));
  writeFileSync(join(tmp, ".sage", "lane"), JSON.stringify({ owns: ["src/api/**"] }));

  const allow = runAsClaude("sage-lane", JSON.stringify({ tool_input: { file_path: "src/api/x.ts" } }), tmp);
  assert.deepEqual(allow.json, {});
  assert.equal(allow.status, 0);

  const deny = runAsClaude("sage-lane", JSON.stringify({ tool_input: { file_path: "src/web/x.ts" } }), tmp);
  assert.equal(deny.json.hookSpecificOutput?.permissionDecision, "deny");
  assert.equal(deny.json.decision, "block");
  assert.equal(deny.status, 2);

  // failClosed: malformed payload denies on Claude Code too, exit 2.
  const mal = runAsClaude("sage-lane", "{", tmp);
  assert.equal(mal.json.hookSpecificOutput?.permissionDecision, "deny");
  assert.equal(mal.status, 2);
});

test("sage-proof: Stop CAN block on Claude Code (decision/reason), unlike Cursor's followup_message", () => {
  const tmp = mkdtempSync(join(tmpdir(), "sage-proof-claude-"));
  const sprintDir = join(tmp, ".sage", "sprints", "s1");
  mkdirSync(sprintDir, { recursive: true });
  writeFileSync(join(sprintDir, "ledger.md"), "| n1 | wip | c2 | c3 | c4 | false |\n");
  const sageHome = fileURLToPath(new URL("..", import.meta.url));

  const cursor = run("sage-proof", JSON.stringify({ loop_count: 0 }), { CURSOR_PROJECT_DIR: tmp, SAGE_HOME: sageHome });
  assert.equal(typeof cursor.followup_message, "string");
  assert.equal(cursor.decision, undefined);

  const r = spawnSync(join(hooks, "sage-proof"), {
    input: JSON.stringify({ loop_count: 0 }),
    encoding: "utf8",
    env: {
      ...process.env,
      CURSOR_PLUGIN_ROOT: "",
      CURSOR_PROJECT_DIR: "",
      CLAUDE_PLUGIN_ROOT: "",
      CLAUDE_PROJECT_DIR: tmp,
      SAGE_HOME: sageHome,
    },
  });
  const claude = JSON.parse((r.stdout || "").trim() || "{}");
  assert.equal(claude.decision, "block");
  assert.equal(typeof claude.reason, "string");
  assert.equal(claude.followup_message, undefined);
  assert.equal(r.status, 0, "followup/block uses exit 0, not the deny-only exit 2");
});

test("sage-bootstrap emits Claude Code SessionStart additionalContext shape, not Cursor's env field", () => {
  const tmp = mkdtempSync(join(tmpdir(), "sage-bootstrap-claude-"));
  const boot = runAsClaude("sage-bootstrap", "{}", tmp);
  assert.equal(typeof boot.json.hookSpecificOutput?.additionalContext, "string");
  assert.equal(boot.json.hookSpecificOutput?.hookEventName, "SessionStart");
  assert.equal(typeof boot.json.additionalContext, "string");
  assert.equal(boot.json.env, undefined, "Claude Code has no known env-var-injection mechanism, unlike Cursor's sessionStart");
});

test("host-detect falls back to the payload's hook_event_name when no host env var is set", () => {
  // No CURSOR_*/CLAUDE_* env at all: PascalCase hook_event_name -> claude shape.
  const r = spawnSync(join(hooks, "sage-careful"), {
    input: JSON.stringify({ hook_event_name: "PreToolUse", command: "rm -rf /" }),
    encoding: "utf8",
    env: { ...process.env, CURSOR_PLUGIN_ROOT: "", CURSOR_PROJECT_DIR: "", CLAUDE_PLUGIN_ROOT: "", CLAUDE_PROJECT_DIR: "" },
  });
  const json = JSON.parse((r.stdout || "").trim() || "{}");
  assert.equal(json.hookSpecificOutput?.permissionDecision, "deny");
  assert.equal(r.status, 2);
});

void chmodSync;
