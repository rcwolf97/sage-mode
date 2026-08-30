import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import {
  validate,
  plan,
  lanes,
  globIntersect,
  validateFile,
  type Dag,
  type DagNode,
  type NodeInterfaces,
} from "../lib/dag/index.js";
import { pluginRoot } from "../lib/util.js";

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
  // lanes() is 0-indexed, matching plan().waves — wave 0 is the first wave.
  const v = lanes(dag, 0);
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

// Regression cases for a live false negative an adversarial re-review found:
// globToRegExp/segmentRegExp escaped `[` as a literal character (no POSIX
// character-class support at all) and let `?` fall through to the "insert
// literally" branch, where it's a live regex metachar (zero-or-one of the
// preceding char) rather than "exactly one character" — silently making
// owns globs using either construct invisible to D2, even though
// hooks/sage-lane's runtime enforcement already implements both correctly
// (fnmatch on the python branch, its own char-class parser on the node
// branch). Reproduced end-to-end at the CLI (`sage dag lanes`) with a real
// committed tree before this fix, not just as a unit-test artifact.
test("globIntersect catches a POSIX character class against a matching literal (with and without a real tree)", () => {
  assert.equal(globIntersect("src/[ab]*.ts", "src/api.ts", ["src/api.ts"]), true);
  assert.equal(globIntersect("src/[ab]*.ts", "src/api.ts", []), true);
});

test("globIntersect catches `?` (single-char wildcard) against a matching literal (with and without a real tree)", () => {
  assert.equal(globIntersect("src/a?.ts", "src/ab.ts", ["src/ab.ts"]), true);
  assert.equal(globIntersect("src/a?.ts", "src/ab.ts", []), true);
});

test("globIntersect correctly rejects a negated character class against a literal it excludes", () => {
  assert.equal(globIntersect("src/[!ab]*.ts", "src/api.ts", []), false);
});

test("globIntersect correctly accepts a negated character class against a literal it doesn't exclude", () => {
  assert.equal(globIntersect("src/[!ab]*.ts", "src/xyz.ts", []), true);
});

test("globIntersect correctly rejects `?` against a literal of the wrong length", () => {
  assert.equal(globIntersect("src/c?.ts", "src/ab.ts", []), false);
});

// Brace-expansion adversarial cases. Neither globToRegExp here nor
// hooks/sage-lane's runtime matcher implement shell-style `{a,b}` expansion —
// `{`/`}`/`,` all fall through to literal-character handling (the escape
// list covers `{`/`}` as regex metachars but not as glob syntax). That's
// safe rather than silently wrong specifically because it's consistent with
// the runtime enforcer: an owns glob written with brace syntax is treated as
// a literal string on both sides of the boundary, so it never diverges into
// "conflict detector says safe, enforcer denies the write" or vice versa.
test("globIntersect treats {a,b} as a literal string, not shell-style expansion — no false positive against a real src/a.ts in the tree", () => {
  const tree = ["src/a.ts", "src/b.ts"];
  assert.equal(globIntersect("src/{a,b}.ts", "src/a.ts", tree), false);
});

test("globIntersect treats {a,b} as a literal string on an empty tree too (fallback path agrees with the tree-expansion path)", () => {
  assert.equal(globIntersect("src/{a,b}.ts", "src/a.ts", []), false);
});

test("globIntersect matches a real file that is literally named with braces against a wildcard that also matches that literal name", () => {
  const tree = ["src/{a,b}.ts"];
  assert.equal(globIntersect("src/{a,b}.ts", "src/*.ts", tree), true);
});

// Doubled/nested ** shapes. globToRegExp's `**` handling only special-cases
// a single `**` segment plus an optional following `/`; two `**` segments in
// a row re-enter that branch twice and should collapse to the same language
// as a single `**` (zero or more segments) rather than accidentally
// requiring at least one segment per star, or leaving a stray literal `*`
// that would narrow the match.
test("globIntersect handles doubled ** (a/**/**/b) matching multiple segments between a and b, same as a single **", () => {
  const tree = ["a/x/y/b"];
  assert.equal(globIntersect("a/**/**/b", "a/x/y/b", tree), true);
});

test("globIntersect handles doubled ** (a/**/**/b) collapsing to zero segments — matches a/b directly, doesn't require one segment per star", () => {
  const tree = ["a/b"];
  assert.equal(globIntersect("a/**/**/b", "a/b", tree), true);
});

test("globIntersect handles doubled ** (a/**/**/b) on an empty tree via the pattern-only fallback, same result as the tree-expansion path", () => {
  assert.equal(globIntersect("a/**/**/b", "a/x/y/b", []), true);
});

test("globIntersect: a bare **/** matches everything, same as a single **, not requiring two path segments", () => {
  const tree = ["anything/here.ts"];
  assert.equal(globIntersect("**/**", "anything/here.ts", tree), true);
});

// Glob-vs-glob intersection: both sides are open patterns, not a literal
// file on one side. Most existing coverage above is glob-vs-literal-path;
// these exercise the tree-expansion primary path when BOTH matchesA and
// matchesB come from wildcard expansion.
test("globIntersect on a real tree: src/*.ts (open) intersects src/** (open) through a shared concrete file, not just a literal path", () => {
  const tree = ["src/api.ts", "src/nested/deep.ts"];
  assert.equal(globIntersect("src/*.ts", "src/**", tree), true);
});

test("globIntersect on a real tree correctly rejects two open patterns with disjoint extensions once concrete files show they never overlap: src/*.ts vs src/*.js", () => {
  const tree = ["src/api.ts", "src/other.js"];
  assert.equal(globIntersect("src/*.ts", "src/*.js", tree), false);
});

test("globIntersect on a real tree correctly rejects two open patterns rooted in different directories: src/*.ts vs lib/*.ts", () => {
  const tree = ["src/api.ts", "lib/util.ts"];
  assert.equal(globIntersect("src/*.ts", "lib/*.ts", tree), false);
});

test("globIntersect: a character-class open pattern (src/[ab]*.ts) intersects a recursive open pattern (src/**/*.ts) through a shared file, on tree and fallback alike", () => {
  const tree = ["src/api.ts"];
  assert.equal(globIntersect("src/[ab]*.ts", "src/**/*.ts", tree), true);
  assert.equal(globIntersect("src/[ab]*.ts", "src/**/*.ts", []), true);
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

// --- lanes() wave indexing (0-indexed, matching plan().waves) ---------

test("lanes() is 0-indexed: every wave index plan() produces is valid on lanes() and reports no wave-code violation", () => {
  const { waves } = plan(base);
  for (const i of waves.keys()) {
    const v = lanes(base, i);
    assert.ok(!v.some((x) => x.code === "wave"), `wave ${i} unexpectedly reported a wave violation`);
  }
});

test("lanes() reports a wave violation for a negative index", () => {
  const v = lanes(base, -1);
  assert.ok(v.some((x) => x.code === "wave"));
});

test("lanes() reports a wave violation for an index one past the last wave", () => {
  const { waves } = plan(base);
  const v = lanes(base, waves.length);
  assert.ok(v.some((x) => x.code === "wave"));
});

// --- top-level constraints[] -------------------------------------------

test("dag validate accepts a valid constraints array and does not flag it", () => {
  const dag: Dag = { ...base, constraints: ["Node version must be >= 18.x for all backend nodes."] };
  const v = validate(dag);
  assert.ok(!v.some((x) => x.message.includes("constraints")));
});

test("dag validate rejects a constraints entry that is too short, naming its index", () => {
  const dag: Dag = { ...base, constraints: ["too short"] };
  const v = validate(dag);
  assert.ok(v.some((x) => x.code === "schema" && x.message.includes("constraints[0]")));
});

test("dag validate rejects a non-string constraints entry, naming its index", () => {
  const dag = { ...base, constraints: [123 as unknown as string] } as Dag;
  const v = validate(dag);
  assert.ok(v.some((x) => x.code === "schema" && x.message.includes("constraints[0]")));
});

test("dag validate with no constraints field validates exactly as before (backward compatible)", () => {
  const v = validate(base);
  assert.ok(!v.some((x) => x.message.includes("constraints")));
});

// --- unknown/misspelled fields (schemas/dag.schema.json declares
// additionalProperties: false everywhere; validate() must actually enforce
// that, not just document it — otherwise a typo silently loses the field it
// meant to set instead of failing loudly). -------------------------------

test("dag validate rejects a misspelled node field (dependsOn instead of depends_on) instead of silently ignoring it", () => {
  // The realistic failure this guards against: an author typos depends_on
  // as dependsOn. Without an additionalProperties check, this node quietly
  // has NO dependencies (dependsOn is not a real field, depends_on is
  // undefined) — it lands in wave 0 with none of the ordering the author
  // intended, and validate() reports a clean bill of health.
  const dag = {
    ...base,
    nodes: [{ ...base.nodes[0]!, depends_on: undefined, dependsOn: ["n2"] }, base.nodes[1]!],
  } as unknown as Dag;
  const v = validate(dag);
  assert.ok(
    v.some((x) => x.code === "schema" && /dependsOn/.test(x.message)),
    `expected a schema violation naming the unknown field "dependsOn": ${JSON.stringify(v)}`,
  );
});

test("dag validate rejects an unknown top-level field on the dag object", () => {
  const dag = { ...base, bogusTopLevelField: true } as unknown as Dag;
  const v = validate(dag);
  assert.ok(
    v.some((x) => x.code === "schema" && /bogusTopLevelField/.test(x.message)),
    `expected a schema violation naming the unknown top-level field: ${JSON.stringify(v)}`,
  );
});

test("dag validate rejects an unknown field inside interfaces", () => {
  const dag: Dag = {
    ...base,
    nodes: [
      { ...base.nodes[0]!, interfaces: { consumes: [], bogus: true } as unknown as NodeInterfaces },
      base.nodes[1]!,
    ],
  };
  const v = validate(dag);
  assert.ok(
    v.some((x) => x.code === "schema" && /bogus/.test(x.message)),
    `expected a schema violation naming the unknown interfaces field: ${JSON.stringify(v)}`,
  );
});

test("dag validate accepts a fully well-formed dag with no unknown fields anywhere (backward compatible)", () => {
  const v = validate(base);
  assert.ok(!v.some((x) => x.code === "schema" && /unknown|unexpected/i.test(x.message)));
});

// --- per-node interfaces: referential validation ------------------------

test("dag validate: interface-unproduced when a node consumes an identifier nothing produces", () => {
  const dag: Dag = {
    ...base,
    nodes: [
      { ...base.nodes[0]!, interfaces: { consumes: ["auth.verifyToken"] } },
      { ...base.nodes[1]!, depends_on: ["n1"] },
    ],
  };
  const v = validate(dag);
  const hit = v.find((x) => x.code === "interface-unproduced");
  assert.ok(hit);
  assert.match(hit!.message, /n1/);
  assert.match(hit!.message, /auth\.verifyToken/);
});

test("dag validate: interface-duplicate when two different nodes produce the same identifier", () => {
  const dag: Dag = {
    ...base,
    nodes: [
      { ...base.nodes[0]!, interfaces: { produces: ["auth.verifyToken"] } },
      { ...base.nodes[1]!, depends_on: [], interfaces: { produces: ["auth.verifyToken"] } },
    ],
  };
  const v = validate(dag);
  const hit = v.find((x) => x.code === "interface-duplicate");
  assert.ok(hit);
  assert.match(hit!.message, /n1/);
  assert.match(hit!.message, /n2/);
  assert.match(hit!.message, /auth\.verifyToken/);
});

test("dag validate: interface-self when a node consumes an identifier it also produces itself", () => {
  const dag: Dag = {
    ...base,
    nodes: [
      { ...base.nodes[0]!, interfaces: { consumes: ["auth.verifyToken"], produces: ["auth.verifyToken"] } },
      base.nodes[1]!,
    ],
  };
  const v = validate(dag);
  const hit = v.find((x) => x.code === "interface-self");
  assert.ok(hit);
  assert.match(hit!.message, /n1/);
  assert.match(hit!.message, /auth\.verifyToken/);
});

test("dag validate: interface-order when a node consumes an identifier from a producer it does not (transitively) depend on", () => {
  // n1 produces, n2 consumes but does NOT depend on n1 — sibling nodes, no edge between them.
  const dag: Dag = {
    ...base,
    nodes: [
      { ...base.nodes[0]!, depends_on: [], interfaces: { produces: ["auth.verifyToken"] } },
      { ...base.nodes[1]!, depends_on: [], interfaces: { consumes: ["auth.verifyToken"] } },
    ],
  };
  const v = validate(dag);
  const hit = v.find((x) => x.code === "interface-order");
  assert.ok(hit);
  assert.match(hit!.message, /n2/);
  assert.match(hit!.message, /auth\.verifyToken/);
});

test("dag validate: interface-order is transitive — a consumer two hops away from its producer is still fine", () => {
  const dag: Dag = {
    ...base,
    nodes: [
      { ...base.nodes[0]!, id: "n1", depends_on: [], interfaces: { produces: ["auth.verifyToken"] } },
      { ...base.nodes[1]!, id: "n2", depends_on: ["n1"] },
      { ...base.nodes[1]!, id: "n3", depends_on: ["n2"], interfaces: { consumes: ["auth.verifyToken"] } },
    ],
  };
  const v = validate(dag);
  assert.ok(!v.some((x) => x.code.startsWith("interface-")));
});

test("dag validate: happy path — a node consuming an identifier produced by a direct dependency validates clean", () => {
  const dag: Dag = {
    ...base,
    nodes: [
      { ...base.nodes[0]!, interfaces: { produces: ["auth.verifyToken"] } },
      { ...base.nodes[1]!, depends_on: ["n1"], interfaces: { consumes: ["auth.verifyToken"] } },
    ],
  };
  const v = validate(dag);
  assert.ok(!v.some((x) => x.code.startsWith("interface-")));
});

test("dag validate with no interfaces field on any node validates exactly as before (backward compatible)", () => {
  const v = validate(base);
  assert.ok(!v.some((x) => x.code.startsWith("interface-")));
});

test("evals/fixtures/interfaces-dag.json (happy path: constraints + chained consumes/produces) validates clean", () => {
  const v = validateFile(join(pluginRoot, "evals", "fixtures", "interfaces-dag.json"));
  assert.deepEqual(v, []);
});

// --- D7 (high-risk-per-wave) wave numbering must be 0-indexed, matching
// plan()/lanes() and the CLI's documented `--wave N` (0-indexed) convention.
// A D7 message naming the wrong wave number sends the user to `sage dag
// lanes --wave N` with an N that inspects the WRONG wave (off by one) —
// a real usability bug in a mechanism whose failure mode is aborting a build.
test("dag validate: D7 high-risk-wave message uses the same 0-indexed wave number as plan()/lanes(), not a 1-indexed one", () => {
  const risky = (id: string, deps: string[]): DagNode => ({
    id,
    title: `High risk node ${id}`,
    role: "backend",
    depends_on: deps,
    owns: [`src/${id}/**`],
    acceptance: ["exits 0 on a clean run"],
    verify: "npm test",
    risk: "high",
  });
  // Wave 0: n1 (low risk, satisfies "nodes minItems 1" trivially as a root).
  // Wave 1 (the SECOND wave, index 1): three high-risk nodes depending on n1.
  const dag: Dag = {
    version: 1,
    sprint: "01-test",
    base: "main",
    nodes: [
      { ...base.nodes[0]!, id: "n1", depends_on: [], risk: "low" },
      risky("n2", ["n1"]),
      risky("n3", ["n1"]),
      risky("n4", ["n1"]),
    ],
  };
  const { waves } = plan(dag);
  // Sanity: the three high-risk nodes really do land together in wave index 1.
  assert.deepEqual(waves[1], ["n2", "n3", "n4"]);
  const v = validate(dag);
  const hit = v.find((x) => x.code === "D7");
  assert.ok(hit, "expected a D7 violation for 3 high-risk nodes in one wave");
  // The message must cite wave index 1 (0-indexed, matching plan().waves and
  // `sage dag lanes --wave 1`) — NOT "wave 2" (the old 1-indexed convention).
  assert.match(hit!.message, /\bwave 1\b/);
  assert.ok(!/\bwave 2\b/.test(hit!.message), `D7 message must not use 1-indexed wave numbering: ${hit!.message}`);
});

// --- interface-duplicate must be about ambiguous ownership between DISTINCT
// nodes, not a single node's own array repeating an identifier -----------
test("dag validate: a single node repeating the same identifier twice in its own produces array is not misreported as multi-node interface-duplicate", () => {
  const dag: Dag = {
    ...base,
    nodes: [
      { ...base.nodes[0]!, depends_on: [], interfaces: { produces: ["auth.verifyToken", "auth.verifyToken"] } },
      { ...base.nodes[1]!, depends_on: [] },
    ],
  };
  const v = validate(dag);
  const hit = v.find((x) => x.code === "interface-duplicate");
  assert.ok(!hit, `a single node's own duplicate produces entry must not be reported as "produced by multiple nodes": ${hit?.message}`);
});

// --- interface-order: diamond dependency (n1 -> n2,n3 -> n4) -------------
test("dag validate: interface-order across a diamond — n4 depends on n1 via two paths (n2 and n3) and may consume what n1 produces", () => {
  const node = (id: string, deps: string[], extra: Partial<DagNode> = {}): DagNode => ({
    ...base.nodes[1]!,
    id,
    depends_on: deps,
    ...extra,
  });
  const dag: Dag = {
    ...base,
    nodes: [
      node("n1", [], { interfaces: { produces: ["auth.verifyToken"] } }),
      node("n2", ["n1"]),
      node("n3", ["n1"]),
      node("n4", ["n2", "n3"], { interfaces: { consumes: ["auth.verifyToken"] } }),
    ],
  };
  const v = validate(dag);
  assert.ok(!v.some((x) => x.code.startsWith("interface-")), JSON.stringify(v));
});

// --- interface-order: a long chain (n1 -> n2 -> ... -> n6) ---------------
test("dag validate: interface-order across a five-hop chain still resolves", () => {
  const node = (id: string, deps: string[], extra: Partial<DagNode> = {}): DagNode => ({
    ...base.nodes[1]!,
    id,
    depends_on: deps,
    ...extra,
  });
  const dag: Dag = {
    ...base,
    nodes: [
      node("n1", [], { interfaces: { produces: ["auth.verifyToken"] } }),
      node("n2", ["n1"]),
      node("n3", ["n2"]),
      node("n4", ["n3"]),
      node("n5", ["n4"]),
      node("n6", ["n5"], { interfaces: { consumes: ["auth.verifyToken"] } }),
    ],
  };
  const v = validate(dag);
  assert.ok(!v.some((x) => x.code.startsWith("interface-")), JSON.stringify(v));
});

// --- interface-order: a producer that depends on ITS consumer (reverse
// edge) must never let the consumer slip past the order check ------------
test("dag validate: interface-order rejects a producer that depends on its own consumer (reverse edge), it does not satisfy the order requirement", () => {
  // n2 consumes what n1 produces, but the edge runs the wrong way: n1
  // depends on n2 (so n2 is built first) instead of n2 depending on n1.
  const dag: Dag = {
    ...base,
    nodes: [
      { ...base.nodes[0]!, id: "n1", depends_on: ["n2"], interfaces: { produces: ["auth.verifyToken"] } },
      { ...base.nodes[1]!, id: "n2", depends_on: [], interfaces: { consumes: ["auth.verifyToken"] } },
    ],
  };
  const v = validate(dag);
  const hit = v.find((x) => x.code === "interface-order");
  assert.ok(hit, "n2 does not transitively depend on n1 (the edge runs the other way) — must be flagged");
});

// --- interface identifiers are matched by exact string equality: case and
// surrounding whitespace are NOT normalized, so a mismatch is explicitly
// rejected (interface-unproduced) rather than silently treated as a match.
test("dag validate: interface identifier matching is case-sensitive — a differently-cased consume is reported unproduced, not silently matched", () => {
  const dag: Dag = {
    ...base,
    nodes: [
      { ...base.nodes[0]!, depends_on: [], interfaces: { produces: ["auth.verifyToken"] } },
      { ...base.nodes[1]!, depends_on: ["n1"], interfaces: { consumes: ["Auth.verifyToken"] } },
    ],
  };
  const v = validate(dag);
  assert.ok(v.some((x) => x.code === "interface-unproduced"), "differently-cased identifiers must not silently match");
});

test("dag validate: interface identifier matching is whitespace-sensitive — a trailing-space consume is reported unproduced, not silently matched", () => {
  const dag: Dag = {
    ...base,
    nodes: [
      { ...base.nodes[0]!, depends_on: [], interfaces: { produces: ["auth.verifyToken"] } },
      { ...base.nodes[1]!, depends_on: ["n1"], interfaces: { consumes: ["auth.verifyToken "] } },
    ],
  };
  const v = validate(dag);
  assert.ok(v.some((x) => x.code === "interface-unproduced"), "trailing-whitespace identifiers must not silently match");
});

// --- validate() must terminate (no hang / stack overflow) on a cyclic DAG,
// even though the interface rules run in the same pass as the cycle check.
test("dag validate: terminates cleanly on a cyclic DAG while still running the interface-order check (no hang, no crash)", () => {
  const dag: Dag = {
    ...base,
    nodes: [
      { ...base.nodes[0]!, id: "n1", depends_on: ["n2"], interfaces: { produces: ["auth.verifyToken"] } },
      { ...base.nodes[1]!, id: "n2", depends_on: ["n1"], interfaces: { consumes: ["auth.verifyToken"] } },
    ],
  };
  const start = Date.now();
  const v = validate(dag);
  assert.ok(Date.now() - start < 2000, "validate() must return quickly on a cyclic DAG, not hang");
  assert.ok(v.some((x) => x.code === "D1" && x.message.includes("cycle")), "the cycle itself must still be reported");
});
