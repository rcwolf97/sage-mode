import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

export const VERSION = "1.0.0";

export const pluginRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function homeDir(): string {
  return process.env.HOME || homedir();
}

export function sageUserDir(): string {
  return join(homeDir(), ".sage");
}

export function readSageHome(): string | null {
  const cfg = join(sageUserDir(), "config.json");
  if (!existsSync(cfg)) return process.env.SAGE_HOME || pluginRoot;
  try {
    const parsed = JSON.parse(readFileSync(cfg, "utf8")) as { sageHome?: string };
    return parsed.sageHome || process.env.SAGE_HOME || pluginRoot;
  } catch {
    return process.env.SAGE_HOME || pluginRoot;
  }
}

export function gitRoot(cwd = process.cwd()): string | null {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    encoding: "utf8",
  });
  if (r.status !== 0) return null;
  return (r.stdout || "").trim() || null;
}

export function git(args: string[], cwd?: string): { status: number; stdout: string; stderr: string } {
  const r = spawnSync("git", args, {
    cwd: cwd || process.cwd(),
    encoding: "utf8",
  });
  return {
    status: r.status ?? 1,
    stdout: r.stdout || "",
    stderr: r.stderr || "",
  };
}

export function ensureDir(p: string): void {
  mkdirSync(p, { recursive: true });
}

export function writeJson(path: string, value: unknown): void {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function projectSageDir(root?: string): string {
  const r = root || gitRoot() || process.cwd();
  return join(r, ".sage");
}

export function projectDocsDir(root?: string): string {
  const r = root || gitRoot() || process.cwd();
  const cfgPath = join(r, ".sage", "config.json");
  if (existsSync(cfgPath)) {
    try {
      const cfg = readJson<{ notebook?: { root?: string } }>(cfgPath);
      if (cfg.notebook?.root) return join(r, cfg.notebook.root);
    } catch {
      /* fall through */
    }
  }
  return join(r, "docs");
}

export function absPath(p: string, cwd = process.cwd()): string {
  return isAbsolute(p) ? p : resolve(cwd, p);
}

export function jsonOut(value: unknown, json: boolean): void {
  if (json) {
    process.stdout.write(JSON.stringify(value, null, 2) + "\n");
  }
}

export function fail(message: string, code = 1): never {
  process.stderr.write(message + "\n");
  process.exit(code);
}

export function flag(argv: string[], name: string): boolean {
  return argv.includes(`--${name}`) || argv.includes(`-${name}`);
}

export function opt(argv: string[], name: string): string | undefined {
  const long = `--${name}`;
  const i = argv.indexOf(long);
  if (i >= 0) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`${long}=`));
  if (eq) return eq.slice(long.length + 1);
  return undefined;
}

export function takeRest(argv: string[]): { args: string[]; rest: string[] } {
  const i = argv.indexOf("--");
  if (i < 0) return { args: argv, rest: [] };
  return { args: argv.slice(0, i), rest: argv.slice(i + 1) };
}

export function parseFrontmatter(src: string): { data: Record<string, unknown>; body: string } {
  if (!src.startsWith("---\n") && !src.startsWith("---\r\n")) {
    return { data: {}, body: src };
  }
  const rest = src.slice(4);
  const end = rest.search(/\n---\r?\n/);
  if (end < 0) return { data: {}, body: src };
  const yaml = rest.slice(0, end);
  const body = rest.slice(end).replace(/^\n---\r?\n/, "");
  const data: Record<string, unknown> = {};
  for (const line of yaml.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    let v: unknown = m[2].trim();
    if (typeof v === "string") {
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      } else if (v === "true") v = true;
      else if (v === "false") v = false;
      else if (/^-?\d+$/.test(v)) v = Number(v);
      else if (v.startsWith("[") && v.endsWith("]")) {
        v = v
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean);
      }
    }
    data[m[1]] = v;
  }
  return { data, body };
}

export function emitYaml(data: Record<string, unknown>): string {
  const lines = ["---"];
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v)) lines.push(`${k}: [${v.map((x) => String(x)).join(", ")}]`);
    else if (v === undefined || v === null) continue;
    else if (typeof v === "string" && /[:#]/.test(v)) lines.push(`${k}: "${v.replace(/"/g, '\\"')}"`);
    else lines.push(`${k}: ${String(v)}`);
  }
  lines.push("---");
  return lines.join("\n");
}
