import assert from "node:assert/strict";
import test from "node:test";
import { gate, dedup } from "../lib/review/index.js";
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
    assert.equal(out[0].confidence, 5);
});
test("review dedup boosts a two-specialist match by exactly 1 and caps at 10", () => {
    const a = {
        severity: "HIGH",
        confidence: 8,
        path: "src/a.ts",
        line: 1,
        category: "security",
        summary: "x",
        evidence: "const x = 1",
        specialist: "security",
    };
    const b = { ...a, specialist: "correctness", confidence: 7 };
    const out = dedup([a, b]);
    assert.equal(out.length, 1);
    assert.equal(out[0].confidence, 9);
    const cap = { ...a, confidence: 10, specialist: "security" };
    const cap2 = { ...a, confidence: 10, specialist: "testing" };
    const out2 = dedup([cap, cap2]);
    assert.equal(out2[0].confidence, 10);
});
