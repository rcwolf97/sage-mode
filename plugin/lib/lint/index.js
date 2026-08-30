import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { parseFrontmatter, pluginRoot } from "../util.js";
const CAP = {
    "sage-shape": 900,
    "design-intake": 900,
};
const DEFAULT_CAP = 250;
// A SKILL.md this far under its declared cap reads as scaffolded-but-never-written
// (M8): the cap-only checks below catch overshoot but nothing previously caught this.
// Calibrated empirically against this repo's actual prose density (long, dense
// lines rather than many short ones — see sage-shape at 409/900 = 45% for a
// procedure judged complete): 0.25 flagged multiple skills confirmed complete
// during the fix pass (design-system, design-motion, sage-setup, sage-status,
// etc., all 11-24% of cap) as false positives. 0.10 still catches genuinely
// empty scaffolding (the original thin sage-shape was 42/900 = 4.7%) without
// tripping on legitimately concise-but-complete content.
const FLOOR_RATIO = 0.10;
// The 25 catalog/ skills are a deliberately different genre: short, single-purpose
// specialist pointers loaded on demand, not multi-step procedures — a uniform
// ~35-line length is consistent with that design and is not on its own evidence
// of abandoned scaffolding. Exempt them from the length-based floor check; the
// ceiling (line-cap) and every other rule still applies.
//
// IMPORTANT: this exemption previously carried a comment claiming the 25 files
// had been "reviewed and confirmed present/correct." That claim was false — an
// independent blind review diffed the files directly and found all 25 are
// byte-identical templates with the skill name substituted in and no real
// per-skill content. A line-count floor cannot detect that failure mode at all
// (identical *and* short is indistinguishable from unique-but-concise at the
// threshold this file uses), so the exemption alone left this rule blind to
// exactly the bug that was actually present. The templated-duplicate check
// below is what now catches it: it compares normalized bodies of sibling
// SKILL.md files directly and flags byte-identical copies, which is a
// mechanical, content-based signal instead of a length heuristic backed by an
// unverified claim.
function isCatalogSkill(skillMd) {
    return skillMd.split("/").includes("catalog");
}
// Two or more SKILL.md files in the same category directory whose bodies are
// identical once each file's own name AND its own applies_when phrase are
// normalized out are templates that were never actually filled in for at
// least one of them (usually all of them) — real, independently-written
// skills do not coincidentally converge on byte-identical prose. Both fields
// are stripped because the catalog template's one per-skill substitution point
// is the applies_when phrase dropped into a rationalization-table row, not the
// name alone: normalizing only the name still leaves 25 distinct bodies and
// silently misses the duplication (verified directly against this repo's own
// catalog/ skills — stripping name alone found 0 duplicate groups; stripping
// both collapses all 25 to a single template). This is a content-identity
// check, not a length heuristic, so it catches templated stubs regardless of
// FLOOR_RATIO/isCatalogSkill and regardless of how "complete" a file looks by
// line count alone.
function normalizeForDupeCheck(body, name, appliesWhen) {
    let out = body;
    if (name)
        out = out.split(name).join("<SKILL_NAME>");
    if (appliesWhen)
        out = out.split(appliesWhen).join("<APPLIES_WHEN>");
    return out.replace(/\s+/g, " ").trim();
}
const ROLE_CAP = 80;
const CONDUCT_CAP = 400;
const CONDUCT_PHRASES = [
    "You're absolutely right",
    "decision-brief format",
    "NOTICED BUT NOT TOUCHING",
];
function walk(root, pred, acc = []) {
    if (!existsSync(root))
        return acc;
    for (const name of readdirSync(root)) {
        const p = join(root, name);
        const st = statSync(p);
        if (st.isDirectory())
            walk(p, pred, acc);
        else if (pred(name, p))
            acc.push(p);
    }
    return acc;
}
function lineCount(text) {
    return text.split(/\r?\n/).length;
}
// True if `dir` exists and contains at least one regular file, anywhere in its subtree.
function hasAnyFile(dir) {
    if (!existsSync(dir))
        return false;
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isFile())
            return true;
        if (st.isDirectory() && hasAnyFile(p))
            return true;
    }
    return false;
}
// ---------------------------------------------------------------------------
// Shared plugin-root assets a skill may legitimately point at without that
// counting as reaching outside its own directory (self-containment, below).
// A skill's own `references/*` needs no allowlist — it never leaves the
// skill's tree. These are the deliberately shared exceptions this design
// depends on.
const SHARED_ROOT_PREFIXES = ["templates/", "schemas/", "profiles/"];
// Non-catalog skills that intentionally have no commands/*.md entry point —
// thin wrappers/utilities other skills or the CLI call internally, never a
// user-facing `/command`. Keep this allowlist itself short and commented;
// any non-catalog skill NOT in it is expected to have a matching command
// (see checkCommandSkillPairing).
const SUPPORT_SKILLS = new Set([
    "sage-notebook", // rendering wrapper — every notebook-writing skill calls it afterward, not a top-level entry point
    "sage-recall", // retrieval utility other skills call directly mid-procedure, not something a user runs as a command
]);
// Collapses all whitespace, including an embedded newline from a wrapped
// inline-code span (this corpus line-wraps long paths inside a single
// backtick span), so a path split across a source line stays one token.
function collapseWs(s) {
    return s.replace(/\s+/g, "");
}
// Every backtick-delimited inline-code span in `raw`, whitespace-collapsed.
// Backtick spans are how this corpus always writes a literal path — scanning
// only inside them keeps the reference-integrity and self-containment checks
// below from tripping on prose that merely contains the word "references."
function backtickTokens(raw) {
    const out = [];
    const re = /`([^`]*)`/gs;
    let m;
    while ((m = re.exec(raw))) {
        const t = collapseWs(m[1]);
        if (t)
            out.push(t);
    }
    return out;
}
function stripFences(raw) {
    return raw.replace(/```[\s\S]*?```/g, "");
}
// ---------------------------------------------------------------------------
// (1) REFERENCE INTEGRITY. Every `references/…`, `templates/…`, `schemas/…`,
// `profiles/…`, or `skills/<other>/…/references/…` path a SKILL.md names in
// backticks must resolve to a real file — or, for a `<placeholder>` segment
// that can't resolve exactly (e.g. `references/checklists/<specialist>.md`),
// to a real, non-empty directory.
//
// DETECTION POLICY (asymmetric with checkSelfContainment below, deliberately
// — this is the load-bearing reasoning, copied from how compound-engineering
// scopes the same tradeoff): this function scans the RAW text, fenced code
// blocks included. A fenced block in a skill's prose is overwhelmingly a
// real script invocation quoting a real path (`sage notebook render
// docs/sprints/NN-<slug>/spec.md`, a checklist path handed to a Task call) —
// stripping it here would hide exactly the rot this check exists to catch:
// a file that got renamed out from under an instruction that still names
// the old path. checkSelfContainment strips fences for the opposite reason:
// there, a fenced block is where a skill quotes an ESCAPING reference as the
// anti-pattern it is teaching about, not a dependency it actually has.
function checkReferenceIntegrity(root, skillMd, skillDir, raw) {
    const issues = [];
    for (const token of backtickTokens(raw)) {
        let base = null;
        if (token.startsWith("references/"))
            base = skillDir;
        else if (SHARED_ROOT_PREFIXES.some((p) => token.startsWith(p)))
            base = root;
        else if (/^skills\/(?:[^/]+\/)+references\//.test(token))
            base = root;
        else
            continue;
        if (token.endsWith("/")) {
            const dir = join(base, token);
            if (!existsSync(dir) || !statSync(dir).isDirectory()) {
                issues.push({ file: skillMd, rule: "reference-integrity", message: `references non-existent directory \`${token}\`` });
            }
            continue;
        }
        const full = join(base, token);
        if (token.includes("<")) {
            // Can't resolve a placeholder segment exactly — verify the directory
            // it names is real and actually has files in it instead.
            const dir = dirname(full);
            if (!existsSync(dir) || !hasAnyFile(dir)) {
                issues.push({
                    file: skillMd,
                    rule: "reference-integrity",
                    message: `templated path \`${token}\` names a directory that doesn't exist or is empty: ${dir}`,
                });
            }
            continue;
        }
        if (!existsSync(full) || !statSync(full).isFile()) {
            issues.push({ file: skillMd, rule: "reference-integrity", message: `references \`${token}\`, which does not exist (resolved: ${full})` });
        }
    }
    return issues;
}
// ---------------------------------------------------------------------------
// (2) SELF-CONTAINMENT. A skill must not reference files outside its own
// directory tree. `references/*` relative to the skill's own directory is
// always fine (it can't escape). Beyond that, only the shared plugin-root
// assets this design depends on (`rules/sage-conduct.mdc`, `templates/*`,
// `schemas/*`, `profiles/*`) and one deliberate cross-skill form —
// `skills/<other>/…/references/*`, e.g. sage-review dispatching another
// skill's checklist — are allowed. Anything else reaching into another
// skill's directory, and any absolute (`/…`) or home-relative (`~/…`) form
// of one of these reference categories, is a violation: local references
// must be relative and must stay inside the allowlist.
//
// See checkReferenceIntegrity above for why fences are stripped here but not
// there: a fenced block in this corpus is routinely a skill quoting an
// escaping reference as the anti-pattern it's teaching about, not a real
// dependency — scanning it would flag the lesson, not the mistake.
function checkSelfContainment(skillMd, skillDir, skillsRoot, raw) {
    const issues = [];
    const ownRelDir = relative(skillsRoot, skillDir).split("\\").join("/");
    const body = stripFences(raw);
    for (const token of backtickTokens(body)) {
        if (token.startsWith("/") || token.startsWith("~")) {
            const withoutHome = token.startsWith("~") ? token.slice(1) : token;
            const isReferenceShaped = /(^|\/)(references|templates|schemas|profiles)(\/|$)/.test(withoutHome) || withoutHome.startsWith("/skills/");
            if (isReferenceShaped) {
                issues.push({
                    file: skillMd,
                    rule: "self-containment",
                    message: `local reference \`${token}\` uses an absolute/home-relative path — references must be relative`,
                });
            }
            continue;
        }
        if (token.startsWith("skills/")) {
            if (token.includes("*"))
                continue; // a glob over the whole catalog (e.g. `skills/**/SKILL.md`), not a reference to one skill
            const rest = token.slice("skills/".length);
            if (rest === ownRelDir || rest.startsWith(`${ownRelDir}/`))
                continue; // self-reference, fine
            if (/^(?:[^/]+\/)+references\//.test(rest))
                continue; // allowlisted sibling-dispatch form
            issues.push({
                file: skillMd,
                rule: "self-containment",
                message: `references another skill's directory outside the references/ sibling-dispatch allowlist: \`${token}\``,
            });
        }
    }
    return issues;
}
// ---------------------------------------------------------------------------
// (3) CONDUCT-PARITY. rules/sage-conduct.mdc's own text says "Do not paste
// it into skills" — until now that instruction was the entire enforcement
// mechanism (CONDUCT_PHRASES above is a fixed, hand-picked list of three
// known phrases; this generalizes it by extracting straight from the file).
function normalizeConductText(s) {
    return s
        .toLowerCase()
        .replace(/[`*_]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
// Sentences, not lines: sage-conduct.mdc's paragraphs pack several distinct
// normative statements onto one physical line ("Do not open with agreement.
// State the strongest objection to the user's position before supporting
// it."), so a line-based window would miss them. Fences are stripped first —
// a fenced example (the decision-brief shape, the DIFF_START/END wrapper)
// isn't prose to be "restated," it's a literal template; CONDUCT_PHRASES
// above already targets a restatement of those specifically.
//
// Known limitation: the `.!?`-boundary splitter treats an unpunctuated
// markdown table or bullet list as one run-on "sentence" it can't cleanly
// bound, so prose sitting directly against one gets diluted into a much
// larger block and can score below CONDUCT_PARITY_THRESHOLD even if it's a
// real restatement. This only produces false NEGATIVES (a missed
// restatement), never false positives, so it doesn't compromise the
// zero-false-positive bar this check is tuned to — but it means a
// restatement wedged directly before a table is a gap this specific check
// doesn't cover.
function conductSentences(body) {
    const noFences = stripFences(body);
    const text = noFences
        .split(/\r?\n/)
        .filter((l) => !l.trim().startsWith("#"))
        .join(" ");
    const parts = text.split(/(?<=[.!?])\s+(?=[A-Z0-9`"(])/);
    const out = [];
    for (const p of parts) {
        const norm = normalizeConductText(p);
        if (norm.split(" ").filter(Boolean).length < 5)
            continue; // too short to be a "distinctive" sentence
        out.push({ raw: p.trim(), norm });
    }
    return out;
}
// 2-consecutive-sentence windows — long enough to be a "distinctive normative
// block," per the assignment, not a coincidentally shared clause.
function conductBlocks(body) {
    const sentences = conductSentences(body);
    const out = [];
    for (let i = 0; i < sentences.length - 1; i++) {
        const block = `${sentences[i].norm} ${sentences[i + 1].norm}`;
        if (block.split(" ").filter(Boolean).length < 8)
            continue;
        out.push({ block, raw1: sentences[i].raw, raw2: sentences[i + 1].raw });
    }
    return out;
}
function wordJaccard(a, b) {
    const sa = new Set(a.split(" ").filter(Boolean));
    const sb = new Set(b.split(" ").filter(Boolean));
    if (sa.size === 0 || sb.size === 0)
        return 0;
    let inter = 0;
    for (const w of sa)
        if (sb.has(w))
            inter++;
    const union = sa.size + sb.size - inter;
    return union === 0 ? 0 : inter / union;
}
// Two consecutive sentences sharing ≥60% of their (normalized) words with a
// conduct block reads as a restatement, not a coincidence. Calibrated
// against this repo's actual corpus: every SKILL.md currently scores 0
// against every conduct block even down to a 0.3 threshold (verified by
// direct comparison against the shipped content, not assumed) — 0.6 leaves
// comfortable margin above that noise floor while still being a real check.
const CONDUCT_PARITY_THRESHOLD = 0.6;
function conductHeadings(body) {
    return body
        .split(/\r?\n/)
        .filter((l) => /^##\s+/.test(l))
        .map((l) => normalizeConductText(l.replace(/^##\s+/, "")))
        .filter(Boolean);
}
// ---------------------------------------------------------------------------
// (6) ROSTER/CHECKLIST COVERAGE. Generalizes the SPECIALIST_ROSTER-only check
// in test/review.test.ts (which trusts lib/review's hardcoded array as the
// sole source of truth) by reading the actual specialist table straight out
// of skills/sage-review/SKILL.md and the actual checklist filenames off
// disk, then diffing in both directions: a specialist the roster/table names
// with no checklist file, and a checklist file nothing in the skill
// references.
function extractSpecialistTableNames(skillRaw) {
    const lines = skillRaw.split(/\r?\n/);
    const headerIdx = lines.findIndex((l) => /^\s*\|\s*Specialist\s*\|/i.test(l));
    if (headerIdx < 0)
        return [];
    const names = [];
    // headerIdx+1 is the `|---|---|` separator row; data rows start after it
    // and run until the first line that isn't a pipe-table row.
    for (let i = headerIdx + 2; i < lines.length; i++) {
        const m = lines[i].match(/^\s*\|([^|]+)\|/);
        if (!m)
            break;
        names.push(m[1].trim().replace(/^`|`$/g, ""));
    }
    return names;
}
function checkRosterCoverage(root) {
    const issues = [];
    const reviewDir = join(root, "skills", "sage-review");
    if (!existsSync(reviewDir))
        return issues;
    const checklistDir = join(reviewDir, "references", "checklists");
    const checklistNames = new Set(existsSync(checklistDir)
        ? readdirSync(checklistDir)
            .filter((n) => n.endsWith(".md"))
            .map((n) => n.slice(0, -3))
        : []);
    const allMd = walk(reviewDir, (n) => n.endsWith(".md"));
    const concatenated = allMd.map((f) => readFileSync(f, "utf8")).join("\n");
    const pathNames = new Set();
    const pathRe = /references\/checklists\/([a-z0-9-]+)\.md/g;
    let m;
    while ((m = pathRe.exec(concatenated)))
        pathNames.add(m[1]);
    const skillMdPath = join(reviewDir, "SKILL.md");
    const tableNames = existsSync(skillMdPath) ? extractSpecialistTableNames(readFileSync(skillMdPath, "utf8")) : [];
    const mentioned = new Set([...tableNames, ...pathNames]);
    for (const nm of mentioned) {
        if (!checklistNames.has(nm)) {
            issues.push({
                file: skillMdPath,
                rule: "roster-checklist-coverage",
                message: `specialist "${nm}" is referenced in skills/sage-review/ but has no checklist at references/checklists/${nm}.md`,
            });
        }
    }
    for (const nm of checklistNames) {
        if (!mentioned.has(nm)) {
            issues.push({
                file: join(checklistDir, `${nm}.md`),
                rule: "roster-checklist-coverage",
                message: `checklist file "${nm}.md" exists but is not referenced anywhere in skills/sage-review/ (orphaned)`,
            });
        }
    }
    return issues;
}
// ---------------------------------------------------------------------------
// (4) NOTEBOOK-ROOT LITERALS. lib/util.ts's `projectDocsDir` resolves a
// configurable notebook root from `.sage/config.json`'s `notebook.root`
// (default "docs") — but a skill that hardcodes `docs/roadmap.md` or
// `docs/sprints/NN/…` in its prose bypasses that config entirely: honored by
// the CLI, ignored by the skill's own instructions.
//
// Scope: the two artifact-name families the notebook-root bug report named —
// `docs/roadmap.{md,html}` and `docs/sprints/NN…` — not every `docs/`
// mention in the corpus (`docs/design/*`, `docs/assets/`, bare `docs/` as a
// directory concept are a separate, much larger sweep; see
// test/conventions.test.ts for the full reasoning and the current list of
// everything else found).
//
// Exported but deliberately NOT wired into `lint()`: test/conventions.test.ts
// drives this against an allowlist of today's known offenders instead, so
// `sage lint` stays a zero-issue, actionable signal while this specific
// count is driven down over time rather than becoming a hard failure that
// blocks unrelated work the moment it's introduced.
export function findDocsRootLiterals(root = pluginRoot) {
    const issues = [];
    const pattern = /docs\/roadmap\.(?:md|html)\b|docs\/sprints\/NN[\w./<>{},-]*/g;
    for (const skillMd of walk(join(root, "skills"), (n) => n === "SKILL.md")) {
        const raw = readFileSync(skillMd, "utf8");
        const rel = relative(root, skillMd);
        const seen = new Set();
        let m;
        while ((m = pattern.exec(raw))) {
            const literal = m[0].replace(/\.+$/, ""); // strip a trailing sentence period, never part of a real path
            if (seen.has(literal))
                continue;
            seen.add(literal);
            issues.push({
                file: rel,
                rule: "notebook-root-literal",
                message: `hardcodes \`${literal}\` instead of the configurable notebook root (lib/util.ts projectDocsDir, .sage/config.json notebook.root)`,
            });
        }
    }
    return issues;
}
export function lint(root = pluginRoot) {
    const issues = [];
    const skillsRoot = join(root, "skills");
    // Read once, used by the conduct-parity checks inside the per-skill loop below.
    const conductPath = join(root, "rules", "sage-conduct.mdc");
    const conductBody = existsSync(conductPath) ? parseFrontmatter(readFileSync(conductPath, "utf8")).body : "";
    const conductBlockList = conductBody ? conductBlocks(conductBody) : [];
    const conductHeadingList = conductBody ? conductHeadings(conductBody) : [];
    const skillRecords = [];
    for (const skillMd of walk(skillsRoot, (n) => n === "SKILL.md")) {
        const raw = readFileSync(skillMd, "utf8");
        const { data, body } = parseFrontmatter(raw);
        const name = String(data.name || skillMd.split("/").slice(-2, -1)[0]);
        const appliesWhen = String(data.applies_when || "");
        // dirname(skillMd) is the individual skill's own directory (skills/<cat>/<name>/);
        // one level up is the category directory siblings are grouped and compared within.
        skillRecords.push({ skillMd, name, body, appliesWhen, categoryDir: dirname(dirname(skillMd)) });
        // (5) FRONTMATTER VALIDITY: name matches directory, description non-empty.
        const skillDirBase = basename(dirname(skillMd));
        if (!data.name) {
            issues.push({ file: skillMd, rule: "frontmatter-validity", message: `missing \`name\` in frontmatter (directory: ${skillDirBase})` });
        }
        else if (String(data.name) !== skillDirBase) {
            issues.push({
                file: skillMd,
                rule: "frontmatter-validity",
                message: `frontmatter name "${data.name}" does not match its directory "${skillDirBase}"`,
            });
        }
        if (!data.description || !String(data.description).trim()) {
            issues.push({ file: skillMd, rule: "frontmatter-validity", message: "missing or empty `description` in frontmatter" });
        }
        // (1) REFERENCE INTEGRITY and (2) SELF-CONTAINMENT.
        issues.push(...checkReferenceIntegrity(root, skillMd, dirname(skillMd), raw));
        issues.push(...checkSelfContainment(skillMd, dirname(skillMd), skillsRoot, raw));
        // (3) CONDUCT-PARITY.
        if (name !== "sage-conduct") {
            for (const h of body.split(/\r?\n/).filter((l) => /^##\s+/.test(l))) {
                const normH = normalizeConductText(h.replace(/^##\s+/, ""));
                if (normH && conductHeadingList.includes(normH) && !h.includes("sage-conduct")) {
                    issues.push({
                        file: skillMd,
                        rule: "conduct-parity",
                        message: `${name} reuses a rules/sage-conduct.mdc section heading ("${h.trim()}") — that file is loaded once per session; reference it, don't restructure a skill around its headings`,
                    });
                }
            }
            for (const sb of conductBlockList.length ? conductBlocks(body) : []) {
                if (sb.raw1.includes("sage-conduct") || sb.raw2.includes("sage-conduct"))
                    continue;
                for (const cb of conductBlockList) {
                    if (wordJaccard(sb.block, cb.block) >= CONDUCT_PARITY_THRESHOLD) {
                        issues.push({
                            file: skillMd,
                            rule: "conduct-parity",
                            message: `${name} restates rules/sage-conduct.mdc: "${sb.raw1} ${sb.raw2}" closely matches "${cb.raw1} ${cb.raw2}" — reference the rule instead of restating it`,
                        });
                    }
                }
            }
        }
        const cap = CAP[name] ?? DEFAULT_CAP;
        const lines = lineCount(raw);
        if (lines > cap)
            issues.push({ file: skillMd, rule: "line-cap", message: `${name} is ${lines} lines (cap ${cap})` });
        const floor = cap * FLOOR_RATIO;
        if (lines < floor && !isCatalogSkill(skillMd)) {
            issues.push({
                file: skillMd,
                rule: "line-floor",
                message: `${name} is ${lines} lines, under ${Math.round(FLOOR_RATIO * 100)}% of its ${cap}-line cap (floor ~${Math.ceil(floor)}) — looks scaffolded but never actually written`,
            });
        }
        const refsDir = join(dirname(skillMd), "references");
        if (existsSync(refsDir) && !hasAnyFile(refsDir)) {
            issues.push({
                file: refsDir,
                rule: "empty-references",
                message: `${name} declares a references/ directory but it contains no files`,
            });
        }
        if (name !== "sage-recall" && data["disable-model-invocation"] !== true && data["disable-model-invocation"] !== "true") {
            issues.push({
                file: skillMd,
                rule: "disable-model-invocation",
                message: `${name} must set disable-model-invocation: true`,
            });
        }
        for (const heading of ["## Common Rationalizations", "## Red Flags", "## Done when"]) {
            if (!body.includes(heading) && !raw.includes(heading)) {
                issues.push({ file: skillMd, rule: "required-section", message: `${name} missing ${heading}` });
            }
        }
        for (const phrase of CONDUCT_PHRASES) {
            if (name === "sage-conduct")
                continue;
            // A line that names the phrase AND cites rules/sage-conduct.mdc on the same
            // line is a pointer ("...using the decision-brief format defined in
            // `rules/sage-conduct.mdc`...— do not restate that format here"), not a
            // restatement. Only flag occurrences that don't co-occur with the citation.
            const offendingLine = raw.split(/\r?\n/).find((line) => line.includes(phrase) && !line.includes("sage-conduct.mdc"));
            if (offendingLine) {
                issues.push({ file: skillMd, rule: "conduct-dupe", message: `${name} restates conduct phrase: ${phrase}` });
            }
        }
    }
    // Templated-duplicate check: group sibling SKILL.md files by category
    // directory, then by normalized body. Any group of 2+ files sharing an
    // identical normalized body is flagged — see normalizeForDupeCheck above.
    const byCategoryDir = new Map();
    for (const rec of skillRecords) {
        const arr = byCategoryDir.get(rec.categoryDir) ?? [];
        arr.push(rec);
        byCategoryDir.set(rec.categoryDir, arr);
    }
    for (const [categoryDir, recs] of byCategoryDir) {
        if (recs.length < 2)
            continue;
        const byNormalizedBody = new Map();
        for (const rec of recs) {
            const norm = normalizeForDupeCheck(rec.body, rec.name, rec.appliesWhen);
            if (!norm)
                continue; // an empty body is already caught by line-floor/required-section
            const arr = byNormalizedBody.get(norm) ?? [];
            arr.push(rec);
            byNormalizedBody.set(norm, arr);
        }
        for (const group of byNormalizedBody.values()) {
            if (group.length < 2)
                continue;
            const label = categoryDir.split("/").slice(-2).join("/");
            for (const rec of group) {
                issues.push({
                    file: rec.skillMd,
                    rule: "templated-duplicate",
                    message: `${rec.name}'s body is byte-identical (after normalizing out its own name and applies_when) to ${group.length - 1} other skill(s) in ${label} — this reads as an unfilled template, not independently written content`,
                });
            }
        }
    }
    const agentsRoot = join(root, "agents");
    for (const md of walk(agentsRoot, (n) => n.endsWith(".md"))) {
        const raw = readFileSync(md, "utf8");
        const { data } = parseFrontmatter(raw);
        if (lineCount(raw) > ROLE_CAP) {
            issues.push({ file: md, rule: "role-cap", message: `${md} exceeds ${ROLE_CAP} lines` });
        }
        if (!data.lane) {
            issues.push({ file: md, rule: "lane", message: `${md} missing lane frontmatter` });
        }
        // (5) FRONTMATTER VALIDITY: name matches filename, description non-empty.
        const agentBase = basename(md, ".md");
        if (!data.name) {
            issues.push({ file: md, rule: "frontmatter-validity", message: `missing \`name\` in frontmatter (file: ${agentBase}.md)` });
        }
        else if (String(data.name) !== agentBase) {
            issues.push({
                file: md,
                rule: "frontmatter-validity",
                message: `frontmatter name "${data.name}" does not match its filename "${agentBase}"`,
            });
        }
        if (!data.description || !String(data.description).trim()) {
            issues.push({ file: md, rule: "frontmatter-validity", message: "missing or empty `description` in frontmatter" });
        }
    }
    // (5) FRONTMATTER VALIDITY and (7) COMMAND/SKILL PAIRING (direction 1):
    // every commands/*.md has name + description, and "Invoke the `X` skill"
    // names a skill that actually exists.
    const commandsRoot = join(root, "commands");
    const commandedSkillNames = new Set();
    if (existsSync(commandsRoot)) {
        for (const name of readdirSync(commandsRoot).filter((n) => n.endsWith(".md"))) {
            const md = join(commandsRoot, name);
            const raw = readFileSync(md, "utf8");
            const { data, body } = parseFrontmatter(raw);
            const cmdBase = basename(name, ".md");
            if (!data.name) {
                issues.push({ file: md, rule: "frontmatter-validity", message: `missing \`name\` in frontmatter (file: ${name})` });
            }
            else if (String(data.name) !== cmdBase) {
                issues.push({
                    file: md,
                    rule: "frontmatter-validity",
                    message: `frontmatter name "${data.name}" does not match its filename "${cmdBase}"`,
                });
            }
            if (!data.description || !String(data.description).trim()) {
                issues.push({ file: md, rule: "frontmatter-validity", message: "missing or empty `description` in frontmatter" });
            }
            const invoke = body.match(/Invoke the `([a-z0-9-]+)` skill/);
            if (invoke) {
                commandedSkillNames.add(invoke[1]);
                if (!existsSync(join(skillsRoot, invoke[1], "SKILL.md"))) {
                    issues.push({
                        file: md,
                        rule: "command-skill-pairing",
                        message: `invokes skill "${invoke[1]}", which does not exist at skills/${invoke[1]}/SKILL.md`,
                    });
                }
            }
        }
    }
    // (7) COMMAND/SKILL PAIRING (direction 2): every non-catalog skill either
    // has a matching command or is an explicitly allowlisted support skill.
    // Only enforced when commands/ actually exists — lib/lint/index.test.ts
    // exercises `lint()` against synthetic roots that are deliberately just a
    // skills/ tree for other rules, and this direction has nothing to check
    // there.
    if (existsSync(commandsRoot)) {
        for (const rec of skillRecords) {
            const relDir = relative(skillsRoot, dirname(rec.skillMd)).split("\\").join("/");
            if (relDir.split("/")[0] === "catalog")
                continue; // catalog skills are retrieved by sage-recall, never commanded directly
            if (commandedSkillNames.has(rec.name) || SUPPORT_SKILLS.has(rec.name))
                continue;
            issues.push({
                file: rec.skillMd,
                rule: "command-skill-pairing",
                message: `"${rec.name}" has no commands/${rec.name}.md invoking it and is not in the SUPPORT_SKILLS allowlist`,
            });
        }
    }
    // (6) ROSTER/CHECKLIST COVERAGE.
    issues.push(...checkRosterCoverage(root));
    const conduct = join(root, "rules", "sage-conduct.mdc");
    if (existsSync(conduct) && lineCount(readFileSync(conduct, "utf8")) > CONDUCT_CAP) {
        issues.push({ file: conduct, rule: "conduct-cap", message: `sage-conduct exceeds ${CONDUCT_CAP} lines` });
    }
    const hooks = join(root, "hooks", "hooks.json");
    if (existsSync(hooks)) {
        const cfg = JSON.parse(readFileSync(hooks, "utf8"));
        for (const [event, list] of Object.entries(cfg.hooks || {})) {
            for (const h of list) {
                const denyTier = event === "preToolUse" || event === "subagentStart";
                if (denyTier && h.failClosed !== true) {
                    issues.push({ file: hooks, rule: "failClosed", message: `${event} deny-tier hook missing failClosed: true` });
                }
            }
        }
    }
    const schemas = join(root, "schemas");
    const fixtures = join(root, "test", "schema-fixtures");
    if (existsSync(schemas)) {
        for (const name of readdirSync(schemas).filter((n) => n.endsWith(".json"))) {
            const fixture = join(fixtures, name.replace(".schema.json", ".json"));
            if (!existsSync(fixture) && !existsSync(join(root, "test", name.replace(".schema.json", ".fixture.json")))) {
                issues.push({ file: join(schemas, name), rule: "schema-fixture", message: `no test fixture for ${name}` });
            }
        }
    }
    return issues;
}
