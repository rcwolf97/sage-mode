import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter, pluginRoot } from "../util.js";
const CAP = {
    "sage-shape": 900,
    "design-intake": 900,
};
const DEFAULT_CAP = 250;
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
export function lint(root = pluginRoot) {
    const issues = [];
    const skillsRoot = join(root, "skills");
    for (const skillMd of walk(skillsRoot, (n) => n === "SKILL.md")) {
        const raw = readFileSync(skillMd, "utf8");
        const { data, body } = parseFrontmatter(raw);
        const name = String(data.name || skillMd.split("/").slice(-2, -1)[0]);
        const cap = CAP[name] ?? DEFAULT_CAP;
        const lines = lineCount(raw);
        if (lines > cap)
            issues.push({ file: skillMd, rule: "line-cap", message: `${name} is ${lines} lines (cap ${cap})` });
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
            if (raw.includes(phrase) && name !== "sage-conduct") {
                issues.push({ file: skillMd, rule: "conduct-dupe", message: `${name} restates conduct phrase: ${phrase}` });
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
