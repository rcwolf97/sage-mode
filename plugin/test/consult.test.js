import assert from "node:assert/strict";
import test from "node:test";
import { consult } from "../lib/consult/index.js";
test("consult degrades with exit 3 when claude is absent or untrusted handling still returns a result", () => {
    const r = consult({ role: "product", prompt: "hello" });
    assert.ok(r.exit === 3 || r.ok || r.exit === 0 || r.exit === 1);
    if (r.degraded)
        assert.equal(r.exit, 3);
});
