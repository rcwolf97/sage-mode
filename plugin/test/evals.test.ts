import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildIndex, search } from "../lib/recall/index.js";
import { pluginRoot } from "../lib/util.js";
import { validateFile } from "../lib/dag/index.js";
import { gate, parseJsonl } from "../lib/review/index.js";

test("tier-2 recall rank-1 accuracy >= 80% on catalog queries", () => {
  const qpath = join(pluginRoot, "evals", "tier2", "queries.json");
  const { queries } = JSON.parse(readFileSync(qpath, "utf8")) as {
    queries: { q: string; expectIdContains: string; optional?: boolean }[];
  };
  const idx = buildIndex({ skillsRoot: join(pluginRoot, "skills"), docsRoot: join(pluginRoot, "evals") });
  let hits = 0;
  let n = 0;
  for (const q of queries) {
    if (q.optional) continue;
    n++;
    const r = search(idx, q.q, { n: 5 });
    if (r[0] && r[0].id.includes(q.expectIdContains)) hits++;
  }
  const acc = hits / n;
  assert.ok(acc >= 0.8, `rank-1 accuracy ${acc} (${hits}/${n})`);
});

test("overlap dag is refused", () => {
  const v = validateFile(join(pluginRoot, "evals", "fixtures", "overlap-dag.json"));
  assert.ok(v.some((x) => x.code === "D2"));
});

test("planted finding survives the gate with evidence", () => {
  const raw = readFileSync(join(pluginRoot, "evals", "fixtures", "planted.jsonl"), "utf8");
  const out = gate(parseJsonl(raw));
  assert.equal(out[0]!.severity, "CRITICAL");
  assert.ok((out[0]!.confidence ?? 0) >= 7);
  assert.match(out[0]!.evidence || "", /x-api-key/);
});

void fileURLToPath;
void dirname;
