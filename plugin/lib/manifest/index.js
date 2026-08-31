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
import { dirname, join, resolve, sep } from "node:path";
import { VERSION } from "../util.js";
const MANIFEST_REL = join(".sage", "install-manifest.json");
function normalizeRel(p) {
    return p.split("\\").join("/");
}
function manifestPath(root) {
    return join(root, MANIFEST_REL);
}
function fileSha256(absPath) {
    return createHash("sha256").update(readFileSync(absPath)).digest("hex");
}
// Resolves a manifest-recorded path against the project root and refuses to
// hand back anything outside it. Every legitimate entry is written by
// installFile() from a relPath candidateFiles() built itself (never from
// user input), so it can never contain `..` or an absolute path — but the
// manifest on disk is just JSON a user (or a malicious/corrupt repo) can
// hand-edit. A `../../etc/passwd`-style entry, or one that repeats an
// absolute path, must never let classify(), installFile(), or
// plannedRemovals() read, write, or delete something outside the project.
// Returns null for any resolved path that isn't root itself or a descendant
// of it; every caller treats null exactly like "we don't own this" — never
// touch it, in either direction.
function resolveInRoot(root, relPath) {
    const rootAbs = resolve(root);
    const target = resolve(rootAbs, normalizeRel(relPath));
    if (target !== rootAbs && !target.startsWith(rootAbs + sep))
        return null;
    return target;
}
export function readManifest(root) {
    const p = manifestPath(root);
    if (existsSync(p)) {
        try {
            const parsed = JSON.parse(readFileSync(p, "utf8"));
            // A malformed *entry* (missing/non-string path or sha256 — a
            // hand-edit gone wrong, not just unparseable JSON) must not crash
            // classify()/plannedRemovals() downstream: normalizeRel() assumes a
            // string. Drop anything that doesn't look like a real entry rather
            // than let it blow up uninstall/checkHealth/setup with a raw
            // TypeError — the same safe fallback as a fully corrupt manifest,
            // just scoped to the one bad entry instead of the whole file.
            const entries = Array.isArray(parsed.entries)
                ? parsed.entries.filter((e) => !!e && typeof e === "object" && typeof e.path === "string" && typeof e.sha256 === "string")
                : [];
            return {
                version: 1,
                installedAt: typeof parsed.installedAt === "string" ? parsed.installedAt : new Date().toISOString(),
                sageVersion: typeof parsed.sageVersion === "string" ? parsed.sageVersion : VERSION,
                entries,
            };
        }
        catch {
            // Corrupt manifest: fall through to a fresh one rather than throwing —
            // classify() will then see every tracked path as "unowned" and refuse
            // to overwrite anything already on disk, which is the safe failure mode.
        }
    }
    return { version: 1, installedAt: new Date().toISOString(), sageVersion: VERSION, entries: [] };
}
export function writeManifest(root, manifest) {
    const p = manifestPath(root);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(manifest, null, 2) + "\n");
}
function findEntry(manifest, relPath) {
    const norm = normalizeRel(relPath);
    return manifest.entries.find((e) => e.path === norm);
}
function upsertEntry(manifest, relPath, sha256, writtenAt) {
    const norm = normalizeRel(relPath);
    const idx = manifest.entries.findIndex((e) => e.path === norm);
    const entry = { path: norm, sha256, writtenAt };
    if (idx >= 0)
        manifest.entries[idx] = entry;
    else
        manifest.entries.push(entry);
}
export function classify(root, relPath, manifest) {
    const entry = findEntry(manifest, relPath);
    if (!entry)
        return "unowned";
    const abs = resolveInRoot(root, relPath);
    // An entry whose recorded path escapes the project root is never trusted
    // enough to plan a removal or a refresh against — treat it the same as no
    // entry at all (see resolveInRoot above).
    if (!abs)
        return "unowned";
    if (!existsSync(abs))
        return "missing";
    return fileSha256(abs) === entry.sha256 ? "owned-clean" : "owned-modified";
}
// Writes `content` to `destAbs` via a same-directory temp file + rename, so the
// destination is never observably partial — either the previous bytes are
// still there or the complete new bytes are, never a truncated in-between
// state, even if the process is killed mid-write. This is the atomic-swap
// guarantee at file granularity: a crash never corrupts a file we own.
function atomicWrite(destAbs, content) {
    mkdirSync(dirname(destAbs), { recursive: true });
    const tmp = `${destAbs}.sage-tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    writeFileSync(tmp, content);
    renameSync(tmp, destAbs);
}
export function installFile(root, relPath, sourceAbsPath, manifest) {
    const norm = normalizeRel(relPath);
    const abs = resolveInRoot(root, norm);
    if (!abs) {
        // relPath escapes the project root. candidateFiles() never produces one
        // of these, but installFile is an exported entry point on its own — this
        // is the last line of defense against ever writing outside the project,
        // no matter what a future or malicious caller hands it.
        return { path: norm, action: "preserved", reason: "unowned" };
    }
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
export function plannedRemovals(root, manifest) {
    const out = [];
    for (const entry of manifest.entries) {
        const cls = classify(root, entry.path, manifest);
        if (cls === "owned-clean" || cls === "missing")
            out.push(entry.path);
    }
    return out;
}
