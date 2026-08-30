// FORENSIC OBSERVABILITY OF ATTEMPTED EGRESS — NOT AN EXFILTRATION CONTROL.
//
// sage-mode deliberately sends work to two third-party vendors: Lane B ships
// briefs and specs to Anthropic via the `claude` CLI (lib/consult), and
// Lane C ships source diffs and review dispatches to Google (gemini,
// via the review skill's Cursor-native model dispatch, recorded through
// `recordLaneCDispatch` in lib/consult). That cross-vendor split is the
// anti-collusion property of the design — this ledger is the record of it.
//
// This module answers exactly one question, on demand: "what has this
// checkout attempted to send to a third-party model vendor, and is that
// record intact?" Every row is hash-chained to its predecessor —
// `hash = sha256(prev_hash + canonical_json(row_without_hash))`, the first
// row's `prev_hash` anchored to a fixed genesis constant — so `verify()`
// can detect three specific kinds of after-the-fact tampering:
//   - an in-place edit to any row's content
//   - reordering rows within the file
//   - deleting a row out of the middle of the chain
//
// It does NOT detect, and does not attempt to detect:
//   - truncating the tail of the file (deleting the most recent N rows)
//   - deleting the whole file and re-fabricating a new, internally
//     self-consistent chain from scratch
// Both are trivially available to anyone who already has filesystem access
// to `.sage/egress.jsonl` — the same actor this ledger is written by. A
// local process that can write the file can always choose not to call
// record(), or replace the file wholesale before anyone reads it. No hash
// chain rooted in the same filesystem can prevent that, and claiming
// otherwise would be exactly the kind of overclaim this repo's other
// modules (lib/consult's extractModelReceipt, lib/evidence's wtree/TOCTOU
// guard) go out of their way to avoid. What this DOES buy: the ordinary
// ways evidence quietly rots — an accidental edit, a reordering, a silent
// mid-chain deletion — are caught. The deliberate, well-resourced cover-up
// of someone who already controls the disk is not, and cannot be, in scope
// for a log that lives on that same disk. If that adversary model matters,
// this ledger needs to ship to somewhere this process doesn't control (a
// remote log sink, an append-only object store); that shipping step does
// not exist yet and is intentionally left out of this module.
//
// grants() is the other half of the honesty requirement: it doesn't just
// say what happened, it says what is *currently permitted* to happen, and
// exactly how to turn each permission off — a security conversation this
// answers with a command, not a promise.

import { existsSync, mkdirSync, readFileSync, appendFileSync, openSync, closeSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { sha256, projectSageDir, sageUserDir, readJson } from "../util.js";

export const GENESIS_HASH = "0".repeat(64);

export interface EgressEntry {
  sink: string;
  model: string;
  lane: string;
  sprint?: string;
  node?: string;
  bytes: number;
  content_sha256: string;
  redactions: number;
}

export interface EgressRow extends EgressEntry {
  seq: number;
  ts: string;
  prev_hash: string;
  hash: string;
}

export interface VerifyResult {
  ok: boolean;
  brokenAt?: number;
  reason?: string;
}

export interface Grant {
  lane: string;
  sink: string;
  model: string;
  revokeCommand: string;
}

export function egressPath(root: string): string {
  return join(projectSageDir(root), "egress.jsonl");
}

// Deterministic, sorted-key JSON serialization — the same logical row must
// hash the same way regardless of the object literal's property insertion
// order. `undefined` values are dropped (matching JSON.stringify's own
// behavior) so an entry built without `sprint`/`node` hashes identically to
// one that explicitly set them to `undefined`.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map((v) => canonicalJson(v)).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k])).join(",") + "}";
}

function readRowsForgiving(path: string): EgressRow[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as EgressRow;
      } catch {
        return null;
      }
    })
    .filter((r): r is EgressRow => !!r);
}

// record() is read-modify-append: read the ledger's last row, compute the
// next seq/hash from it, then append. Two `sage` processes calling record()
// against the same ledger at the same moment (e.g. two lanes dispatching
// concurrently) can both read the same "last row" before either has
// appended, then both append a row claiming the same seq/prev_hash — a
// silent, non-malicious corruption that verify() then reports as a broken
// chain, indistinguishable from actual tampering. A simple exclusive
// lockfile around the critical section serializes same-machine writers so
// that race can't happen. Bounded spin-wait (not fully blocking) with a
// stale-lock break so a process that died holding the lock can't wedge the
// ledger shut forever.
function withLedgerLock<T>(dir: string, fn: () => T): T {
  const lockPath = join(dir, "egress.jsonl.lock");
  const staleAfterMs = 5000;
  const deadline = Date.now() + staleAfterMs;
  let fd: number | null = null;
  while (fd === null) {
    try {
      fd = openSync(lockPath, "wx");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      if (Date.now() > deadline) {
        // Stale lock (holder crashed without cleaning up): break it and
        // retry rather than wedging every future record() call forever.
        try {
          unlinkSync(lockPath);
        } catch {
          /* another process already broke/cleared it — just retry */
        }
        continue;
      }
      sleepSyncMs(5);
    }
  }
  try {
    return fn();
  } finally {
    closeSync(fd);
    try {
      unlinkSync(lockPath);
    } catch {
      /* already gone */
    }
  }
}

// A true synchronous sleep — record() must stay synchronous (it's called
// from synchronous CLI code paths), so this can't be a Promise/setTimeout.
// Atomics.wait on a throwaway SharedArrayBuffer blocks this thread only,
// without spinning the CPU, and is available in Node without special flags.
function sleepSyncMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Append one receipt row, chaining it to whatever the ledger's current last
// row is (or to GENESIS_HASH if the ledger is missing or empty). Safe to
// call against a project that has never had a `.sage` directory before.
export function record(root: string, entry: EgressEntry): EgressRow {
  const dir = projectSageDir(root);
  mkdirSync(dir, { recursive: true });
  return withLedgerLock(dir, () => {
    const path = egressPath(root);
    const rows = readRowsForgiving(path);
    const last = rows.at(-1);
    const seq = (last?.seq ?? 0) + 1;
    const prev_hash = last?.hash ?? GENESIS_HASH;
    const rowSansHash: Omit<EgressRow, "hash"> = {
      seq,
      ts: new Date().toISOString(),
      sink: entry.sink,
      model: entry.model,
      lane: entry.lane,
      sprint: entry.sprint,
      node: entry.node,
      bytes: entry.bytes,
      content_sha256: entry.content_sha256,
      redactions: entry.redactions,
      prev_hash,
    };
    const hash = sha256(prev_hash + canonicalJson(rowSansHash));
    const row: EgressRow = { ...rowSansHash, hash };
    appendFileSync(path, JSON.stringify(row) + "\n");
    return row;
  });
}

export function list(root: string, opts?: { sprint?: string }): EgressRow[] {
  const rows = readRowsForgiving(egressPath(root));
  if (!opts?.sprint) return rows;
  return rows.filter((r) => r.sprint === opts.sprint);
}

// Recomputes the chain from GENESIS_HASH and reports the first row where
// it breaks. See the module header for exactly what this can and cannot
// detect.
export function verify(root: string): VerifyResult {
  const path = egressPath(root);
  if (!existsSync(path)) {
    return { ok: true, reason: "no ledger file yet — nothing has been recorded" };
  }
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
  if (lines.length === 0) {
    return { ok: true, reason: "ledger file exists but is empty" };
  }

  let expectedPrev = GENESIS_HASH;
  let expectedSeq = 1;
  for (const line of lines) {
    let row: EgressRow;
    try {
      row = JSON.parse(line) as EgressRow;
    } catch {
      return { ok: false, brokenAt: expectedSeq, reason: "row is not valid JSON" };
    }
    if (row.seq !== expectedSeq) {
      return {
        ok: false,
        brokenAt: expectedSeq,
        reason: `expected seq ${expectedSeq} at this position, found ${row.seq} — rows were reordered or removed`,
      };
    }
    if (row.prev_hash !== expectedPrev) {
      return {
        ok: false,
        brokenAt: row.seq,
        reason: "prev_hash does not match the predecessor's hash — chain broken (a row was edited, reordered, or deleted)",
      };
    }
    const { hash, ...rest } = row;
    const recomputed = sha256(row.prev_hash + canonicalJson(rest));
    if (recomputed !== hash) {
      return { ok: false, brokenAt: row.seq, reason: "row hash does not match its own content — this row was edited" };
    }
    expectedPrev = hash;
    expectedSeq++;
  }
  return { ok: true, reason: `chain verified across ${lines.length} row(s)` };
}

// Model-string prefix -> (lane, sink). Only lanes this codebase itself
// dispatches over the network are reported: Lane B (`claude` CLI ->
// Anthropic, lib/consult's own spawnSync call) and Lane C (gemini ->
// Google, lib/consult's recordLaneCDispatch seam for the review skill).
// Lane A (grok-* Cursor-subagent dispatch via `model:` frontmatter) is
// deliberately NOT reported here: it is Cursor's own model routing, not
// something any function in this repo invokes or can observe — the same
// scoping lib/consult's extractModelReceipt documents for why it can't
// verify Lane A either. A lane whose configured model matches neither
// prefix (grok-*, "local", "included", unset) is treated as staying on
// the machine and is silently skipped, not flagged as an error.
const LANE_BY_MODEL_PREFIX: Array<{ prefix: RegExp; lane: string; sink: string }> = [
  { prefix: /^claude/i, lane: "B", sink: "anthropic" },
  { prefix: /^gemini/i, lane: "C", sink: "google" },
];

// POSIX single-quote a string for safe literal use as one shell word: close
// the quote, insert an escaped quote, reopen. Safe against every shell
// metacharacter (backticks, $, ;, newlines, embedded quotes included) —
// nothing inside a single-quoted string is interpreted by the shell.
function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function revokeCommandFor(role: string): string {
  // A literal, copy-pasteable command run from the project root that flips
  // this one lane to a non-egressing model, in place, in the same config
  // file `sage setup` wrote. No new CLI surface required to run it.
  //
  // `role` comes from `.sage/config.json`'s `lanes` object keys — a
  // project-level file that can be committed to, and shared from, a repo
  // this process did not author (the exact "untrusted input" this whole
  // module exists to be honest about). It must never be interpolated
  // directly into the JS source string handed to `node -e`: a role name
  // like `x']='local';require('child_process').exec(...)//` would close
  // the string literal early and inject arbitrary code into a command this
  // module explicitly advertises as safe to copy-paste and run. Instead the
  // role is passed as a separate, shell-quoted positional argument after
  // `--`, and the static `-e` script reads it from process.argv[1] — the
  // role string is never parsed as code, by the shell or by node, no matter
  // what it contains.
  return (
    `node -e "const fs=require('node:fs');const p='.sage/config.json';` +
    `const c=JSON.parse(fs.readFileSync(p,'utf8'));c.lanes[process.argv[1]]='local';` +
    `fs.writeFileSync(p,JSON.stringify(c,null,2)+'\\n');" -- ${shellQuote(role)}`
  );
}

function readLanes(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  try {
    const cfg = readJson<{ lanes?: Record<string, string> }>(path);
    return cfg.lanes || {};
  } catch {
    return {};
  }
}

// What is permitted to leave, right now, per the config actually on disk —
// and the exact command that revokes each permission. Reads the project's
// `.sage/config.json` `lanes` map (what `sage setup` writes per-project),
// then layers a `~/.sage/config.json` `lanes` map on top if one exists (the
// project schema is per-project, but a user-level override is honored here
// too rather than silently ignored, so a global lane override actually
// shows up in the answer).
export function grants(root: string): Grant[] {
  const lanes: Record<string, string> = {
    ...readLanes(join(root, ".sage", "config.json")),
    ...readLanes(join(sageUserDir(), "config.json")),
  };
  const out: Grant[] = [];
  for (const [role, model] of Object.entries(lanes)) {
    if (typeof model !== "string") continue;
    const match = LANE_BY_MODEL_PREFIX.find((m) => m.prefix.test(model));
    if (!match) continue;
    out.push({ lane: match.lane, sink: match.sink, model, revokeCommand: revokeCommandFor(role) });
  }
  return out;
}
