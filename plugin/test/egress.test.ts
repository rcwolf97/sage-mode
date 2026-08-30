import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../lib/util.js";
import { record, list, verify, grants, egressPath, canonicalJson, GENESIS_HASH } from "../lib/egress/index.js";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "sage-egress-"));
}

function baseEntry(overrides: Partial<Parameters<typeof record>[1]> = {}) {
  return {
    sink: "anthropic",
    model: "claude-sonnet-5",
    lane: "B",
    bytes: 42,
    content_sha256: "a".repeat(64),
    redactions: 0,
    ...overrides,
  };
}

test("verify on a missing ledger is ok with a clear reason", () => {
  const root = tmp();
  const v = verify(root);
  assert.equal(v.ok, true);
  assert.match(v.reason || "", /no ledger|nothing/i);
});

test("verify on an empty ledger file is ok with a clear reason", () => {
  const root = tmp();
  mkdirSync(join(root, ".sage"), { recursive: true });
  writeFileSync(egressPath(root), "");
  const v = verify(root);
  assert.equal(v.ok, true);
  assert.match(v.reason || "", /empty/i);
});

test("record is safe when .sage does not exist yet, and chains the first row to GENESIS_HASH", () => {
  const root = tmp();
  const row = record(root, baseEntry());
  assert.equal(row.seq, 1);
  assert.equal(row.prev_hash, GENESIS_HASH);
  assert.match(row.hash, /^[0-9a-f]{64}$/);
});

test("appending normally keeps the chain clean, and seq/prev_hash advance correctly", () => {
  const root = tmp();
  const r1 = record(root, baseEntry());
  const r2 = record(root, baseEntry({ model: "claude-haiku-5" }));
  const r3 = record(root, baseEntry({ sink: "google", model: "gemini-3.7-flash", lane: "C" }));
  assert.deepEqual(
    [r1.seq, r2.seq, r3.seq],
    [1, 2, 3],
  );
  assert.equal(r2.prev_hash, r1.hash);
  assert.equal(r3.prev_hash, r2.hash);
  const v = verify(root);
  assert.equal(v.ok, true);
  assert.match(v.reason || "", /verified/i);
});

test("list returns rows in append order and filters by sprint", () => {
  const root = tmp();
  record(root, baseEntry({ sprint: "01" }));
  record(root, baseEntry({ sprint: "02" }));
  record(root, baseEntry({ sprint: "01" }));
  const all = list(root);
  assert.equal(all.length, 3);
  const sprint01 = list(root, { sprint: "01" });
  assert.equal(sprint01.length, 2);
  assert.ok(sprint01.every((r) => r.sprint === "01"));
});

test("verify detects an edited row: mutating a mid-chain row's bytes breaks the chain at that row", () => {
  const root = tmp();
  record(root, baseEntry());
  record(root, baseEntry());
  record(root, baseEntry());
  const path = egressPath(root);
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
  const row2 = JSON.parse(lines[1]);
  row2.bytes = 999999; // edited without recomputing hash — the naive-tamper case
  lines[1] = JSON.stringify(row2);
  writeFileSync(path, lines.join("\n") + "\n");

  const v = verify(root);
  assert.equal(v.ok, false);
  assert.equal(v.brokenAt, 2);
  assert.match(v.reason || "", /edited|hash/i);
});

test("verify detects an edited row even when the attacker recomputes that row's own hash (self-consistent edit): the break surfaces on the next row", () => {
  const root = tmp();
  record(root, baseEntry());
  record(root, baseEntry());
  record(root, baseEntry());
  const path = egressPath(root);
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
  const row2 = JSON.parse(lines[1]);
  row2.bytes = 999999;
  // Attacker recomputes row2's own hash to stay self-consistent with the edit
  // (same formula record()/verify() use), but does NOT touch row3 — the real
  // cryptographic property under test is that this doesn't help: row3 still
  // points at the OLD row2 hash, so the break surfaces one row downstream.
  const { hash: _oldHash, ...rowSansHash } = row2;
  void _oldHash;
  row2.hash = sha256(row2.prev_hash + canonicalJson(rowSansHash));
  lines[1] = JSON.stringify(row2);
  writeFileSync(path, lines.join("\n") + "\n");

  const v = verify(root);
  assert.equal(v.ok, false);
  assert.equal(v.brokenAt, 3); // row 3's prev_hash no longer matches row 2's new hash
});

test("verify detects a deleted mid-chain row", () => {
  const root = tmp();
  record(root, baseEntry());
  record(root, baseEntry());
  record(root, baseEntry());
  const path = egressPath(root);
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
  const kept = [lines[0], lines[2]]; // drop the middle row
  writeFileSync(path, kept.join("\n") + "\n");

  const v = verify(root);
  assert.equal(v.ok, false);
  assert.ok(typeof v.brokenAt === "number");
});

test("verify detects reordered rows", () => {
  const root = tmp();
  record(root, baseEntry());
  record(root, baseEntry());
  record(root, baseEntry());
  const path = egressPath(root);
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
  const swapped = [lines[1], lines[0], lines[2]];
  writeFileSync(path, swapped.join("\n") + "\n");

  const v = verify(root);
  assert.equal(v.ok, false);
});

test("grants reports each non-local configured lane with a literal revoke command, and skips local/grok/unknown lanes", () => {
  const root = tmp();
  mkdirSync(join(root, ".sage"), { recursive: true });
  writeFileSync(
    join(root, ".sage", "config.json"),
    JSON.stringify({
      version: 1,
      lanes: {
        product: "claude-cli",
        architect: "grok-4.6", // Lane A — Cursor-native, not this repo's egress
        reviewer: "gemini-3.7-flash",
        red_team: "gemini-3.7-flash",
        implementer: "local", // already off
      },
    }),
  );
  const g = grants(root);
  const roles = g.map((x) => x.lane + ":" + x.sink);
  assert.equal(g.length, 3); // product, reviewer, red_team — not architect or implementer
  assert.ok(roles.includes("B:anthropic"));
  assert.ok(roles.includes("C:google"));
  for (const grant of g) {
    assert.ok(grant.revokeCommand.length > 0);
    assert.match(grant.revokeCommand, /config\.json/);
    assert.match(grant.revokeCommand, /'local'/);
  }
});

test("grants returns an empty list when there is no config at all", () => {
  const root = tmp();
  assert.deepEqual(grants(root), []);
});
