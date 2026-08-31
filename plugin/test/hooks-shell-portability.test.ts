import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const hooksDir = fileURLToPath(new URL("../hooks", import.meta.url));

// Nested heredoc inside `$(python3|node|awk|sed …)` is unparseable on
// bash 3.2 (`/bin/sh` on macOS). CI's ubuntu-latest `sh` is dash, so this
// class of bug is invisible there — this grep is the actual regression
// guard. See ship-tech-spec.md §2.1 / §2.2.
const NESTED = /=\$\((python3|node|awk|sed)\b[^)]*<</;

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

test("hooks/ must not nest a heredoc inside $(python3|node|awk|sed) command substitution", () => {
  const hits: string[] = [];
  for (const file of walk(hooksDir)) {
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\n/);
    for (let i = 0; i < lines.length; i++) {
      if (NESTED.test(lines[i]!)) hits.push(`${file}:${i + 1}`);
    }
  }
  assert.deepEqual(hits, [], `heredoc-in-$() found:\n${hits.join("\n")}`);
});
