import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "../lib/notebook/index.js";

test("notebook fixture renders callout, table wrap, mermaid, and md links", () => {
  const dir = mkdtempSync(join(tmpdir(), "sage-nb-"));
  const src = fileURLToPath(new URL("../lib/notebook/__fixtures__/spec.md", import.meta.url));
  const dest = join(dir, "spec.md");
  mkdirSync(join(dir, "assets"), { recursive: true });
  copyFileSync(src, dest);
  const htmlPath = render(dest);
  const html = readFileSync(htmlPath, "utf8");
  assert.match(html, /Fixture spec/);
  assert.match(html, /class="tw"/);
  assert.match(html, /class="mermaid"/);
  assert.match(html, /plan\.html/);
  assert.doesNotMatch(html, /https?:\/\/cdn/);
});

// M4 regression: asset hrefs must resolve relative to the PROJECT docs root the
// page is rendered into, never to an absolute path back into wherever the plugin
// itself happens to be installed (Cursor's content-hashed plugin cache dirs change
// on every update, so any absolute/plugin-rooted href breaks on the next update).
test("notebook asset hrefs are project-relative, never absolute or plugin-rooted", () => {
  const dir = mkdtempSync(join(tmpdir(), "sage-nb-"));
  const src = fileURLToPath(new URL("../lib/notebook/__fixtures__/spec.md", import.meta.url));
  const dest = join(dir, "spec.md");
  mkdirSync(join(dir, "assets"), { recursive: true });
  copyFileSync(src, dest);
  const htmlPath = render(dest);
  const html = readFileSync(htmlPath, "utf8");
  const hrefs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(hrefs.includes("assets/notebook.css"), `expected a relative assets/notebook.css href, got: ${hrefs.join(", ")}`);
  assert.ok(hrefs.includes("assets/mermaid.min.js"), `expected a relative assets/mermaid.min.js src, got: ${hrefs.join(", ")}`);
  for (const href of hrefs) {
    assert.ok(!href.startsWith("/"), `href must not be absolute: ${href}`);
    assert.doesNotMatch(href, /plugin/, `href must not point into the plugin's own install dir: ${href}`);
  }
});

// Same check, one directory deeper — proves the relative prefix walks up ("../assets/...")
// rather than being hardcoded to the top-level case.
test("notebook asset hrefs walk up correctly for nested project docs", () => {
  const projectDir = mkdtempSync(join(tmpdir(), "sage-proj-"));
  const docsDir = join(projectDir, "docs");
  const nestedDir = join(docsDir, "plans");
  mkdirSync(join(docsDir, "assets"), { recursive: true });
  mkdirSync(nestedDir, { recursive: true });
  const src = fileURLToPath(new URL("../lib/notebook/__fixtures__/spec.md", import.meta.url));
  const dest = join(nestedDir, "spec.md");
  copyFileSync(src, dest);
  const htmlPath = render(dest);
  const html = readFileSync(htmlPath, "utf8");
  assert.match(html, /href="\.\.\/assets\/notebook\.css"/);
  assert.match(html, /src="\.\.\/assets\/mermaid\.min\.js"/);
  assert.doesNotMatch(html, /plugin/);
});

void dirname;
