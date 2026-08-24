import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseFrontmatter, pluginRoot } from "../util.js";

export interface LintIssue {
  file: string;
  rule: string;
  message: string;
}

const CAP: Record<string, number> = {
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
function isCatalogSkill(skillMd: string): boolean {
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
function normalizeForDupeCheck(body: string, name: string, appliesWhen: string): string {
  let out = body;
  if (name) out = out.split(name).join("<SKILL_NAME>");
  if (appliesWhen) out = out.split(appliesWhen).join("<APPLIES_WHEN>");
  return out.replace(/\s+/g, " ").trim();
}
const ROLE_CAP = 80;
const CONDUCT_CAP = 400;
const CONDUCT_PHRASES = [
  "You're absolutely right",
  "decision-brief format",
  "NOTICED BUT NOT TOUCHING",
];

function walk(root: string, pred: (n: string, p: string) => boolean, acc: string[] = []): string[] {
  if (!existsSync(root)) return acc;
  for (const name of readdirSync(root)) {
    const p = join(root, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, pred, acc);
    else if (pred(name, p)) acc.push(p);
  }
  return acc;
}

function lineCount(text: string): number {
  return text.split(/\r?\n/).length;
}

// True if `dir` exists and contains at least one regular file, anywhere in its subtree.
function hasAnyFile(dir: string): boolean {
  if (!existsSync(dir)) return false;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isFile()) return true;
    if (st.isDirectory() && hasAnyFile(p)) return true;
  }
  return false;
}

export function lint(root = pluginRoot): LintIssue[] {
  const issues: LintIssue[] = [];
  const skillsRoot = join(root, "skills");
  const skillRecords: { skillMd: string; name: string; body: string; appliesWhen: string; categoryDir: string }[] = [];
  for (const skillMd of walk(skillsRoot, (n) => n === "SKILL.md")) {
    const raw = readFileSync(skillMd, "utf8");
    const { data, body } = parseFrontmatter(raw);
    const name = String(data.name || skillMd.split("/").slice(-2, -1)[0]);
    const appliesWhen = String(data.applies_when || "");
    // dirname(skillMd) is the individual skill's own directory (skills/<cat>/<name>/);
    // one level up is the category directory siblings are grouped and compared within.
    skillRecords.push({ skillMd, name, body, appliesWhen, categoryDir: dirname(dirname(skillMd)) });
    const cap = CAP[name] ?? DEFAULT_CAP;
    const lines = lineCount(raw);
    if (lines > cap) issues.push({ file: skillMd, rule: "line-cap", message: `${name} is ${lines} lines (cap ${cap})` });
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
      if (name === "sage-conduct") continue;
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
  const byCategoryDir = new Map<string, typeof skillRecords>();
  for (const rec of skillRecords) {
    const arr = byCategoryDir.get(rec.categoryDir) ?? [];
    arr.push(rec);
    byCategoryDir.set(rec.categoryDir, arr);
  }
  for (const [categoryDir, recs] of byCategoryDir) {
    if (recs.length < 2) continue;
    const byNormalizedBody = new Map<string, typeof recs>();
    for (const rec of recs) {
      const norm = normalizeForDupeCheck(rec.body, rec.name, rec.appliesWhen);
      if (!norm) continue; // an empty body is already caught by line-floor/required-section
      const arr = byNormalizedBody.get(norm) ?? [];
      arr.push(rec);
      byNormalizedBody.set(norm, arr);
    }
    for (const group of byNormalizedBody.values()) {
      if (group.length < 2) continue;
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
  }

  const conduct = join(root, "rules", "sage-conduct.mdc");
  if (existsSync(conduct) && lineCount(readFileSync(conduct, "utf8")) > CONDUCT_CAP) {
    issues.push({ file: conduct, rule: "conduct-cap", message: `sage-conduct exceeds ${CONDUCT_CAP} lines` });
  }

  const hooks = join(root, "hooks", "hooks.json");
  if (existsSync(hooks)) {
    const cfg = JSON.parse(readFileSync(hooks, "utf8")) as {
      hooks?: Record<string, { failClosed?: boolean; matcher?: string }[]>;
    };
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
