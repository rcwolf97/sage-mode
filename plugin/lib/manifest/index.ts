// Install ownership ledger.
//
// The invariant this module exists to enforce (modeled on compound-engineering's
// installer): a writer never claims a path it did not write. Every file sage
// puts into a project is recorded, by content hash, in
// `<project>/.sage/install-manifest.json`. On the next install we don't just
// blindly overwrite — we look at what's actually on disk relative to what we
// last wrote:
//
//   - no manifest entry at all           -> "unowned": either the user's own
//     file, or an install that predates this mechanism. We never touch it
//     while it's present; we only ever write into an unowned *and absent* path.
//   - entry exists, on-disk hash matches -> "owned-clean": ours, untouched by
//     the user since we wrote it. Safe (and expected) to refresh from source.
//   - entry exists, on-disk hash differs -> "owned-modified": the user edited
//     a file we wrote. That edit is the point of the tool. Never clobber it.
//   - entry exists, file is gone         -> "missing": the user removed their
//     override (or the file was deleted some other way). Self-healing: we
//     re-write it from source and resume tracking it.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { VERSION } from "../util.js";

export interface ManifestEntry {
  /** Project-relative path, forward-slash separated. */
  path: string;
  sha256: string;
  writtenAt: string;
}

export interface Manifest {
  version: 1;
  installedAt: string;
  sageVersion: string;
  entries: ManifestEntry[];
}

export type Classification = "unowned" | "owned-clean" | "owned-modified" | "missing";

export type InstallAction = "written" | "refreshed" | "preserved";

export interface InstallResult {
  path: string;
  action: InstallAction;
  /** Set only when action is "preserved" — why we left the file alone. */
  reason?: "unowned" | "owned-modified";
}

const MANIFEST_REL = join(".sage", "install-manifest.json");

function normalizeRel(p: string): string {
  return p.split("\\").join("/");
}

function manifestPath(root: string): string {
  return join(root, MANIFEST_REL);
}

function fileSha256(absPath: string): string {
  return createHash("sha256").update(readFileSync(absPath)).digest("hex");
}

export function readManifest(root: string): Manifest {
  const p = manifestPath(root);
  if (existsSync(p)) {
    try {
      const parsed = JSON.parse(readFileSync(p, "utf8")) as Partial<Manifest>;
      return {
        version: 1,
        installedAt: typeof parsed.installedAt === "string" ? parsed.installedAt : new Date().toISOString(),
        sageVersion: typeof parsed.sageVersion === "string" ? parsed.sageVersion : VERSION,
        entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      };
    } catch {
      // Corrupt manifest: fall through to a fresh one rather than throwing —
      // classify() will then see every tracked path as "unowned" and refuse
      // to overwrite anything already on disk, which is the safe failure mode.
    }
  }
  return { version: 1, installedAt: new Date().toISOString(), sageVersion: VERSION, entries: [] };
}

export function writeManifest(root: string, manifest: Manifest): void {
  const p = manifestPath(root);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(manifest, null, 2) + "\n");
}

function findEntry(manifest: Manifest, relPath: string): ManifestEntry | undefined {
  const norm = normalizeRel(relPath);
  return manifest.entries.find((e) => e.path === norm);
}

function upsertEntry(manifest: Manifest, relPath: string, sha256: string, writtenAt: string): void {
  const norm = normalizeRel(relPath);
  const idx = manifest.entries.findIndex((e) => e.path === norm);
  const entry: ManifestEntry = { path: norm, sha256, writtenAt };
  if (idx >= 0) manifest.entries[idx] = entry;
  else manifest.entries.push(entry);
}

export function classify(root: string, relPath: string, manifest: Manifest): Classification {
  const entry = findEntry(manifest, relPath);
  if (!entry) return "unowned";
  const abs = join(root, normalizeRel(relPath));
  if (!existsSync(abs)) return "missing";
  return fileSha256(abs) === entry.sha256 ? "owned-clean" : "owned-modified";
}

// Writes `content` to `destAbs` via a same-directory temp file + rename, so the
// destination is never observably partial — either the previous bytes are
// still there or the complete new bytes are, never a truncated in-between
// state, even if the process is killed mid-write. This is the atomic-swap
// guarantee at file granularity: a crash never corrupts a file we own.
function atomicWrite(destAbs: string, content: Buffer): void {
  mkdirSync(dirname(destAbs), { recursive: true });
  const tmp = `${destAbs}.sage-tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  writeFileSync(tmp, content);
  renameSync(tmp, destAbs);
}

export function installFile(root: string, relPath: string, sourceAbsPath: string, manifest: Manifest): InstallResult {
  const norm = normalizeRel(relPath);
  const abs = join(root, norm);
  const cls = classify(root, norm, manifest);

  if (cls === "unowned") {
    if (existsSync(abs)) {
      return { path: norm, action: "preserved", reason: "unowned" };
    }
    const content = readFileSync(sourceAbsPath);
    atomicWrite(abs, content);
    upsertEntry(manifest, norm, fileSha256(sourceAbsPath), new Date().toISOString());
    return { path: norm, action: "written" };
  }

  if (cls === "owned-modified") {
    return { path: norm, action: "preserved", reason: "owned-modified" };
  }

  // owned-clean (refresh from source; a no-op rewrite if content is unchanged)
  // or missing (self-heal: re-write and resume tracking).
  const content = readFileSync(sourceAbsPath);
  atomicWrite(abs, content);
  upsertEntry(manifest, norm, fileSha256(sourceAbsPath), new Date().toISOString());
  return { path: norm, action: "refreshed" };
}

export function plannedRemovals(root: string, manifest: Manifest): string[] {
  const out: string[] = [];
  for (const entry of manifest.entries) {
    const cls = classify(root, entry.path, manifest);
    if (cls === "owned-clean" || cls === "missing") out.push(entry.path);
  }
  return out;
}
