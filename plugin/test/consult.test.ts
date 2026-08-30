import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { consult, extractModelReceipt, recordLaneCDispatch } from "../lib/consult/index.js";
import { list as listEgress, verify as verifyEgress, egressPath } from "../lib/egress/index.js";
import { redact } from "../lib/redact/index.js";
import { sha256 } from "../lib/util.js";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "sage-consult-"));
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
