import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildIndex, search } from "../lib/recall/index.js";
test("recall returns [] and never an approximate match for a zero-hit query", () => {
    const dir = mkdtempSync(join(tmpdir(), "sage-re-"));
    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(join(dir, "docs", "a.md"), "---\ntitle: Stripe webhooks\nkind: learning\napplies_when: handling stripe\n---\n\n# hi\nstripe webhook retries\n");
    const idx = buildIndex({ docsRoot: join(dir, "docs"), skillsRoot: join(dir, "noskills"), cwd: dir });
    const hits = search(idx, "zzzzzzzznotatermqqqq");
    assert.deepEqual(hits, []);
});
