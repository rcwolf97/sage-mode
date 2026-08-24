import assert from "node:assert/strict";
import test from "node:test";
import { validate, plan, lanes, globIntersect } from "../lib/dag/index.js";
const base = {
    version: 1,
    sprint: "01-test",
    base: "main",
    nodes: [
        {
            id: "n1",
            title: "Backend ingest path",
            role: "backend",
            owns: ["src/api/**"],
            acceptance: ["POST /ingest returns 401 without a bearer token"],
            verify: "npm test",
            risk: "low",
        },
        {
            id: "n2",
            title: "Frontend ingest form",
            role: "frontend",
            depends_on: ["n1"],
            owns: ["src/ui/**"],
            acceptance: ["The form renders a 401 error string from the API"],
            verify: "npm test",
            risk: "low",
        },
    ],
};
test("dag lanes reports intersection for src/** vs src/api/** on empty tree", () => {
    const dag = {
        ...base,
        nodes: [
            { ...base.nodes[0], id: "n1", owns: ["src/**"], depends_on: [] },
            { ...base.nodes[1], id: "n2", owns: ["src/api/**"], depends_on: [] },
        ],
    };
    const v = lanes(dag, 1);
    assert.ok(v.some((x) => x.code === "D2"));
    assert.equal(globIntersect("src/**", "src/api/**"), true);
});
test("dag validate rejects a cycle, unknown depends_on, and owns **", () => {
    const cycle = {
        ...base,
        nodes: [
            { ...base.nodes[0], depends_on: ["n2"] },
            { ...base.nodes[1], depends_on: ["n1"] },
        ],
    };
    assert.ok(validate(cycle).some((x) => x.code === "D1"));
    const missing = {
        ...base,
        nodes: [{ ...base.nodes[0], depends_on: ["n99"] }],
    };
    assert.ok(validate(missing).some((x) => x.code === "D1"));
    const star = {
        ...base,
        nodes: [{ ...base.nodes[0], owns: ["**"] }],
    };
    assert.ok(validate(star).some((x) => x.code === "D3"));
});
test("dag plan produces topological waves", () => {
    const p = plan(base);
    assert.deepEqual(p.waves[0], ["n1"]);
    assert.deepEqual(p.waves[1], ["n2"]);
});
