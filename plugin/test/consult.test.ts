import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { consult, extractModelReceipt, recordLaneCDispatch, assertTrusted } from "../lib/consult/index.js";
import { list as listEgress, verify as verifyEgress, egressPath } from "../lib/egress/index.js";
import { redact } from "../lib/redact/index.js";
import { sha256 } from "../lib/util.js";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "sage-consult-"));
}

// assertTrusted()/consult() resolve the user-level ~/.sage/config.json
// through process.env.HOME (see lib/util.ts's homeDir()). Redirecting it for
// the duration of a call isolates these tests from the real ~/.sage.
function withHome<T>(dir: string, fn: () => T): T {
  const prev = process.env.HOME;
  process.env.HOME = dir;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.HOME;
    else process.env.HOME = prev;
  }
}

test("consult degrades with exit 3 when claude is absent or untrusted handling still returns a result", () => {
  const cwd = tmp();
  const r = consult({ role: "product", prompt: "hello", cwd });
  assert.ok(r.exit === 3 || r.ok || r.exit === 0 || r.exit === 1);
  if (r.degraded) assert.equal(r.exit, 3);
});

// --- egress ledger wiring ---
//
// The real `claude` binary happens to be present in this sandbox, so the
// test above actually dispatches (see lib/consult/index.ts's comment above
// consult() for exactly when a row is/isn't recorded). These tests pin both
// halves of that documented boundary without mocking the filesystem or the
// child process: a real temp `cwd` is used throughout, and "claude absent"
// is produced by genuinely emptying PATH for the duration of one call, not
// by stubbing spawnSync.

test("a real dispatch (claude present) records at least one egress row on a clean, verifiable chain", () => {
  const cwd = tmp();
  const r = consult({ role: "product", prompt: "hello from the egress wiring test", cwd });
  // Whether or not the real CLI call itself succeeded (network/auth in this
  // sandbox is not this test's concern), the attempt reached spawnSync, so
  // the pre-flight row must exist.
  void r;
  const rows = listEgress(cwd);
  assert.ok(rows.length >= 1, "expected at least the pre-flight egress row");
  for (const row of rows) {
    assert.equal(row.sink, "anthropic");
    assert.equal(row.lane, "B");
    assert.ok(row.bytes > 0);
    assert.match(row.content_sha256, /^[0-9a-f]{64}$/);
  }
  const v = verifyEgress(cwd);
  assert.equal(v.ok, true, v.reason);
});

test("claude genuinely absent (empty PATH): consult still degrades cleanly, and records NOTHING — nothing left the machine, so nothing is logged, by design (see the comment above consult() in lib/consult/index.ts)", () => {
  const cwd = tmp();
  const priorPath = process.env.PATH;
  process.env.PATH = ""; // claudeAvailable()'s `claude --version` now fails to resolve the binary at all
  let r;
  try {
    r = consult({ role: "product", prompt: "hello", cwd });
  } finally {
    process.env.PATH = priorPath;
  }
  assert.equal(r.degraded, true);
  assert.equal(r.exit, 3);
  assert.equal(existsSync(egressPath(cwd)), false, "no ledger file should exist — nothing was ever sent");
});

test("recordLaneCDispatch redacts the payload, records a lane C / google row, and returns the redacted text", () => {
  const cwd = tmp();
  const payload = "diff --git a/x b/x\n+AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\n";
  const out = recordLaneCDispatch(cwd, { model: "gemini-3.7-flash", sprint: "01", node: "n1", payload });
  assert.ok(!out.includes("AKIAIOSFODNN7EXAMPLE"));
  assert.ok(out.includes("«REDACTED:aws-key"));
  const rows = listEgress(cwd, { sprint: "01" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sink, "google");
  assert.equal(rows[0].lane, "C");
  assert.equal(rows[0].model, "gemini-3.7-flash");
  assert.equal(rows[0].node, "n1");
  assert.equal(rows[0].redactions, 1);
  const v = verifyEgress(cwd);
  assert.equal(v.ok, true, v.reason);
});

test("consult redacts the prompt before it is ever handed to the claude subprocess: the recorded content_sha256 matches the REDACTED payload, never the raw secret", () => {
  const cwd = tmp();
  const rawPrompt = "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE — please review";
  consult({ role: "product", prompt: rawPrompt, cwd });
  const rows = listEgress(cwd);
  assert.ok(rows.length >= 1);
  const expectedHash = sha256(redact(rawPrompt).text);
  const rawHash = sha256(rawPrompt);
  for (const row of rows) {
    assert.equal(row.content_sha256, expectedHash);
    assert.notEqual(row.content_sha256, rawHash);
    assert.ok(row.redactions >= 1);
  }
});

// --- schema file content must be redacted too: it is spawned straight into
// the args handed to the `claude` subprocess, the same as the prompt is ---

// A fake `claude` executable that records exactly the argv it was invoked
// with (so the test can inspect what --json-schema actually carried) and
// returns just enough of a real response envelope for consult() to parse
// cleanly.
function installFakeClaude(): { binDir: string; capturedArgsFile: string } {
  const binDir = mkdtempSync(join(tmpdir(), "sage-fakebin-"));
  const capturedArgsFile = join(binDir, "captured-args.json");
  const script = [
    "#!/usr/bin/env node",
    "const fs = require('node:fs');",
    "const args = process.argv.slice(2);",
    "if (args[0] === '--version') { process.stdout.write('1.0.0\\n'); process.exit(0); }",
    `fs.writeFileSync(${JSON.stringify(capturedArgsFile)}, JSON.stringify(args));`,
    "process.stdout.write(JSON.stringify({ session_id: 's1', total_cost_usd: 0, result: 'ok', modelUsage: { 'claude-sonnet-5': {} } }));",
  ].join("\n");
  const binPath = join(binDir, "claude");
  writeFileSync(binPath, script);
  chmodSync(binPath, 0o755);
  return { binDir, capturedArgsFile };
}

function withFakeClaudeOnPath<T>(fn: (paths: { binDir: string; capturedArgsFile: string }) => T): T {
  const paths = installFakeClaude();
  const prevPath = process.env.PATH;
  process.env.PATH = `${paths.binDir}:${prevPath}`;
  try {
    return fn(paths);
  } finally {
    process.env.PATH = prevPath;
  }
}

test("a schema file's content is redacted before it is passed to the claude subprocess via --json-schema, the same as the prompt is", () => {
  const cwd = tmp();
  const schemaPath = join(cwd, "schema.json");
  writeFileSync(
    schemaPath,
    JSON.stringify({
      type: "object",
      description: "example config with a hardcoded default",
      properties: { apiKey: { default: "AKIAIOSFODNN7EXAMPLE" } },
    }),
  );
  const capturedArgsFile = withFakeClaudeOnPath((paths) => {
    consult({ role: "product", prompt: "hello", schema: schemaPath, cwd });
    return paths.capturedArgsFile;
  });
  const args: string[] = JSON.parse(readFileSync(capturedArgsFile, "utf8"));
  const idx = args.indexOf("--json-schema");
  assert.ok(idx >= 0, "expected --json-schema to have been passed");
  const schemaArg = args[idx + 1];
  assert.ok(!schemaArg.includes("AKIAIOSFODNN7EXAMPLE"), `schema content leaked unredacted: ${schemaArg}`);
  assert.ok(schemaArg.includes("«REDACTED:aws-key"), schemaArg);
});

// extractModelReceipt: the Lane B analog of compound-engineering-plugin's
// extract_model_receipt() / MODEL_ACTUAL="unverified" default — the design
// this session's competitive-analysis review found sage-mode had zero code
// for. These cases mirror that file's own defensive posture: absence must
// never be silently upgraded to "verified".

test("extractModelReceipt: real modelUsage envelope is verified with its model keys", () => {
  const out = JSON.stringify({
    type: "result",
    total_cost_usd: 0.0421,
    modelUsage: { "claude-sonnet-5-20260215": { inputTokens: 900, outputTokens: 400 } },
  });
  const receipt = extractModelReceipt(out);
  assert.equal(receipt.verified, true);
  assert.deepEqual(receipt.models, ["claude-sonnet-5-20260215"]);
});

test("extractModelReceipt: multiple models in one envelope are all reported, not just the first", () => {
  const out = JSON.stringify({
    modelUsage: {
      "claude-sonnet-5-20260215": { inputTokens: 100 },
      "claude-haiku-5-20260215": { inputTokens: 50 },
    },
  });
  const receipt = extractModelReceipt(out);
  assert.equal(receipt.verified, true);
  assert.equal(receipt.models.length, 2);
});

test("extractModelReceipt: no modelUsage field at all is unverified, not assumed fine", () => {
  const out = JSON.stringify({ type: "result", total_cost_usd: 0.01, result: "done" });
  const receipt = extractModelReceipt(out);
  assert.equal(receipt.verified, false);
  assert.deepEqual(receipt.models, []);
});

test("extractModelReceipt: modelUsage present but empty object is unverified, not vacuously true", () => {
  const out = JSON.stringify({ modelUsage: {} });
  const receipt = extractModelReceipt(out);
  assert.equal(receipt.verified, false);
  assert.deepEqual(receipt.models, []);
});

test("extractModelReceipt: modelUsage as the wrong shape (array, not object) is unverified, not crash", () => {
  const out = JSON.stringify({ modelUsage: ["claude-sonnet-5"] });
  const receipt = extractModelReceipt(out);
  assert.equal(receipt.verified, false);
  assert.deepEqual(receipt.models, []);
});

test("extractModelReceipt: raw non-JSON text (e.g. a CLI crash message) is unverified, not thrown", () => {
  const receipt = extractModelReceipt("error: command not found");
  assert.equal(receipt.verified, false);
  assert.deepEqual(receipt.models, []);
});

test("extractModelReceipt: empty string input is unverified, not thrown", () => {
  const receipt = extractModelReceipt("");
  assert.equal(receipt.verified, false);
  assert.deepEqual(receipt.models, []);
});

// --- assertTrusted(): an existing user config with an explicitly empty
// trustedRoots list must refuse every root, not silently allow everything ---

test("assertTrusted refuses when ~/.sage/config.json exists but trustedRoots is empty — not the dead branch that silently allows everything", () => {
  const home = mkdtempSync(join(tmpdir(), "sage-userhome-"));
  mkdirSync(join(home, ".sage"), { recursive: true });
  writeFileSync(join(home, ".sage", "config.json"), JSON.stringify({ trustedRoots: [] }));
  const cwd = tmp();
  withHome(home, () => {
    assert.throws(() => assertTrusted(cwd), /not a trusted root/);
  });
});

test("assertTrusted still allows everything when ~/.sage/config.json does not exist at all (first run, before setup writes it)", () => {
  const home = mkdtempSync(join(tmpdir(), "sage-userhome-"));
  const cwd = tmp();
  withHome(home, () => {
    assert.doesNotThrow(() => assertTrusted(cwd));
  });
});

// --- ANTHROPIC_API_KEY inherited-env warning still fires on dispatch ---

test("consult warns on stderr when ANTHROPIC_API_KEY is inherited from the environment, so it doesn't silently route through metered billing", () => {
  const cwd = tmp();
  const prevKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "sk-ant-fake-for-test";
  let captured = "";
  const origWrite = process.stderr.write.bind(process.stderr);
  (process.stderr.write as unknown) = (chunk: string, ...rest: unknown[]) => {
    captured += chunk;
    return (origWrite as (...a: unknown[]) => boolean)(chunk, ...rest);
  };
  try {
    consult({ role: "product", prompt: "hi", cwd });
  } finally {
    process.stderr.write = origWrite;
    if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = prevKey;
  }
  assert.match(captured, /METERED API BILLING/);
});

// --- an egress ledger write failure must never break consult() itself ---

test("consult still completes normally when the egress ledger path is unwritable (a file sits where .sage/ needs to be a directory)", () => {
  const cwd = tmp();
  writeFileSync(join(cwd, ".sage"), "not a directory — mkdir(.sage) will fail inside record()");
  assert.doesNotThrow(() => {
    const r = consult({ role: "product", prompt: "hello despite a broken ledger", cwd });
    assert.ok(typeof r.ok === "boolean");
  });
});
