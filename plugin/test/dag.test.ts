import assert from "node:assert/strict";
import test from "node:test";
import { validate, plan, lanes, globIntersect, type Dag } from "../lib/dag/index.js";

const base: Dag = {
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
  const dag: Dag = {
    ...base,
    nodes: [
      { ...base.nodes[0]!, id: "n1", owns: ["src/**"], depends_on: [] },
      { ...base.nodes[1]!, id: "n2", owns: ["src/api/**"], depends_on: [] },
    ],
  };
  const v = lanes(dag, 1);
  assert.ok(v.some((x) => x.code === "D2"));
  assert.equal(globIntersect("src/**", "src/api/**"), true);
});

// D2 false-negative regression table (Blocker B2). Each of these globs pairs
// a non-trailing wildcard (mid-pattern `*`/`**`, or a leading `**`) against a
// glob or literal path it actually overlaps with. The old prefixOverlap-only
// implementation stripped only a trailing `*`/`**` before comparing literal
// prefixes, so none of these were ever detected — a silent false negative on
// the invariant that makes parallel implementer dispatch safe. Each test
// supplies an explicit simulated tree so it exercises the tree-expansion
// primary path directly, independent of what files happen to exist in the
// repo running the tests.
test("globIntersect true negative regression: src/*.ts intersects src/api.ts (wildcard mid-pattern, not trailing)", () => {
  const tree = ["src/api.ts", "src/other.ts", "src/nested/deep.ts"];
  assert.equal(globIntersect("src/*.ts", "src/api.ts", tree), true);
});

test("globIntersect true negative regression: src/**/*.ts intersects src/api/foo.ts (** in the middle of the pattern)", () => {
  const tree = ["src/api/foo.ts", "src/api/bar.json"];
  assert.equal(globIntersect("src/**/*.ts", "src/api/foo.ts", tree), true);
});

test("globIntersect true negative regression: **/*.test.ts intersects src/api.test.ts (leading **)", () => {
  const tree = ["src/api.test.ts", "src/api.ts"];
  assert.equal(globIntersect("**/*.test.ts", "src/api.test.ts", tree), true);
});

test("globIntersect true negative regression: src/api/** intersects src/**/*.ts (both sides have a non-trailing wildcard)", () => {
  const tree = ["src/api/foo.ts", "src/api/bar.json", "src/other/baz.ts"];
  assert.equal(globIntersect("src/api/**", "src/**/*.ts", tree), true);
});

// Control cases: these already worked under the old prefix-only heuristic
// and must keep working under the tree-expansion primary + prefix fallback.
test("globIntersect control: src/** intersects src/api/** on an empty tree (trailing-** case, must still work via fallback)", () => {
  assert.equal(globIntersect("src/**", "src/api/**", []), true);
});

test("globIntersect control: src/** intersects src/api/foo.ts on an empty tree (dir glob vs literal file)", () => {
  assert.equal(globIntersect("src/**", "src/api/foo.ts", []), true);
});

test("globIntersect control: src/a/** does not intersect src/b/** (disjoint sibling directories, no false positive)", () => {
  assert.equal(globIntersect("src/a/**", "src/b/**", []), false);
});

// Both-sides-empty-tree cases: two nodes creating brand-new files that don't
// exist in the repo yet (the common case at /sage-dag planning time for new
// work, not a rare corner case). Neither side of tree-expansion has anything
// to match against here, so these exercise the pattern-only fallback
// (segmentsCanIntersect) directly rather than prefixOverlap, which would
// reintroduce the original false-negative class for every one of these —
// none of these shapes share a literal prefix once a trailing star (which
// none of them have) is stripped.
test("globIntersect on an empty tree still catches src/*.ts vs src/api.ts (no tree match on either side)", () => {
  assert.equal(globIntersect("src/*.ts", "src/api.ts", []), true);
});

test("globIntersect on an empty tree still catches src/**/*.ts vs src/api/foo.ts (no tree match on either side)", () => {
  assert.equal(globIntersect("src/**/*.ts", "src/api/foo.ts", []), true);
});

test("globIntersect on an empty tree still catches **/*.test.ts vs src/api.test.ts (no tree match on either side)", () => {
  assert.equal(globIntersect("**/*.test.ts", "src/api.test.ts", []), true);
});

test("globIntersect on an empty tree still catches src/api/** vs src/**/*.ts (no tree match on either side)", () => {
  assert.equal(globIntersect("src/api/**", "src/**/*.ts", []), true);
});

test("globIntersect on an empty tree correctly rejects src/*.ts vs src/foo/api.ts (different depth, no false positive)", () => {
  assert.equal(globIntersect("src/*.ts", "src/foo/api.ts", []), false);
});

test("globIntersect on an empty tree correctly rejects two disjoint literal files", () => {
  assert.equal(globIntersect("src/api.ts", "src/other.ts", []), false);
});

test("dag validate rejects a cycle, unknown depends_on, and owns **", () => {
  const cycle: Dag = {
    ...base,
    nodes: [
      { ...base.nodes[0]!, depends_on: ["n2"] },
      { ...base.nodes[1]!, depends_on: ["n1"] },
    ],
  };
  assert.ok(validate(cycle).some((x) => x.code === "D1"));
  const missing: Dag = {
    ...base,
    nodes: [{ ...base.nodes[0]!, depends_on: ["n99"] }],
  };
  assert.ok(validate(missing).some((x) => x.code === "D1"));
  const star: Dag = {
    ...base,
    nodes: [{ ...base.nodes[0]!, owns: ["**"] }],
  };
  assert.ok(validate(star).some((x) => x.code === "D3"));
});

test("dag plan produces topological waves", () => {
  const p = plan(base);
  assert.deepEqual(p.waves[0], ["n1"]);
  assert.deepEqual(p.waves[1], ["n2"]);
});
