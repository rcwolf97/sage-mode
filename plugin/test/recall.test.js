import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildIndex, search, bm25, overlap, tokenize, dedupAppliesWhen } from "../lib/recall/index.js";
function doc(partial) {
    return {
        id: "d",
        path: "d.md",
        kind: "note",
        title: "t",
        tags: [],
        len: Object.values(partial.terms).reduce((s, n) => s + n, 0),
        ...partial,
    };
}
test("recall returns [] and never an approximate match for a zero-hit query", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-re-"));
    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(join(dir, "docs", "a.md"), "---\ntitle: Stripe webhooks\nkind: learning\napplies_when: handling stripe\n---\n\n# hi\nstripe webhook retries\n");
    const idx = buildIndex({ docsRoot: join(dir, "docs"), skillsRoot: join(dir, "noskills"), cwd: dir });
    const hits = search(idx, "zzzzzzzznotatermqqqq");
    assert.deepEqual(hits, []);
});
test("bm25 idf is higher for a rarer term, and longer docs are down-weighted", () => {
    const stats = { N: 2, avgdl: 4, df: { rare: 1, common: 2 } };
    const short = doc({ id: "s", terms: { rare: 1 }, len: 1 });
    const long = doc({ id: "l", terms: { rare: 1 }, len: 20 });
    const common = doc({ id: "c", terms: { common: 1 }, len: 1 });
    assert.ok(bm25(["rare"], short, stats) > bm25(["common"], common, stats));
    assert.ok(bm25(["rare"], short, stats) > bm25(["rare"], long, stats));
});
test("buildIndex tags kind from frontmatter and indexes three roots including out-of-scope", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-re3-"));
    mkdirSync(join(dir, "docs"), { recursive: true });
    mkdirSync(join(dir, "skills", "s"), { recursive: true });
    mkdirSync(join(dir, ".sage", "out-of-scope"), { recursive: true });
    writeFileSync(join(dir, "docs", "a.md"), "---\ntitle: Alpha\nkind: learning\n---\nalpha term uniquealpha\n");
    writeFileSync(join(dir, "skills", "s", "SKILL.md"), "---\nname: s\n---\nskill body uniquealpha\n");
    writeFileSync(join(dir, ".sage", "out-of-scope", "rejected.md"), "---\nkind: out-of-scope\nconcept: widgets\nrejected: 2026-08-31\ntitle: No widgets\n---\nwidgets were rejected uniquealpha\n");
    const idx = buildIndex({
        docsRoot: join(dir, "docs"),
        skillsRoot: join(dir, "skills"),
        scopeRoot: join(dir, ".sage", "out-of-scope"),
        cwd: dir,
    });
    assert.equal(idx.stats.N, 3);
    assert.ok(idx.stats.df.uniquealpha === 3);
    const kinds = [...idx.docs, ...idx.skills].map((d) => d.kind).sort();
    assert.deepEqual(kinds, ["learning", "out-of-scope", "skill"]);
    const hits = search(idx, "widgets", { kind: "out-of-scope" });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, "out-of-scope");
});
test("overlap is Jaccard-on-max-length and zero on empty", () => {
    assert.equal(overlap([], ["a"]), 0);
    assert.equal(overlap(["a", "b"], ["b", "c"]), 0.5);
    assert.equal(overlap(["a"], ["a"]), 1);
});
test("dedupAppliesWhen fires on both sides of the 0.55 threshold", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-re-d-"));
    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(join(dir, "docs", "l.md"), "---\ntitle: Handling stripe webhooks\nkind: learning\napplies_when: handling stripe webhooks retries\n---\nhandling stripe webhooks retries\n");
    const idx = buildIndex({ docsRoot: join(dir, "docs"), skillsRoot: join(dir, "noskills"), cwd: dir });
    const above = dedupAppliesWhen(idx, "handling stripe webhooks retries", 0.55);
    assert.ok(above.length >= 1);
    const below = dedupAppliesWhen(idx, "unrelated zucchini horticulture", 0.55);
    assert.equal(below.length, 0);
});
test("tokenize drops stopwords", () => {
    const t = tokenize("the stripe and the webhook");
    assert.ok(t.includes("stripe"));
    assert.ok(!t.includes("the"));
    assert.ok(!t.includes("and"));
});
