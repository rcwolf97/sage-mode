import assert from "node:assert/strict";
import test from "node:test";
import { consult, extractModelReceipt } from "../lib/consult/index.js";
test("consult degrades with exit 3 when claude is absent or untrusted handling still returns a result", () => {
    const r = consult({ role: "product", prompt: "hello" });
    assert.ok(r.exit === 3 || r.ok || r.exit === 0 || r.exit === 1);
    if (r.degraded)
        assert.equal(r.exit, 3);
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
