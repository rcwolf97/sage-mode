---
name: ce-compound
description: Document a recently solved problem as a durable learning under docs/learnings. Use only when the user invokes /ce-compound.
disable-model-invocation: true
argument-hint: "[optional: brief context]"
---

# /ce-compound

**Outcome:** one solved problem is one short HTML page under `docs/learnings/`, linked from `docs/index.html`, ready to hand to a client.

**Done:** the page is written or updated, frontmatter and claims validated, vocabulary capture recorded even when nothing qualified.

**One learning per run.** A session that produced several gets several sequential runs, never one batched run.

Do not start this skill unless the user invoked `/ce-compound` (or named it explicitly).

Apply `skills/unslop/SKILL.md` to the page. First screen is the whole point. Extra goes in `<details>`.

## Preconditions

Document a problem that is solved, verified working, and non-trivial. Judge from the session; do not interview. When the session plainly holds no such problem, write nothing and say why.

This skill is not a glossary bootstrap. Vocabulary is a side effect of the one learning, never a repo-wide campaign.

## Artifact root

`<root>` is always `docs/learnings` at the git repo root (`git rev-parse --show-toplevel`). Create it if absent.

Write the learning to `<root>/<slug>.html`. Category lives in frontmatter, not in the path. If the target repo has no `docs/index.html`, copy this plugin's `docs/assets/hub.stub.html` to `docs/index.html` and copy `docs/assets/sage-docs.css` to `docs/assets/`. Do not write anywhere else. Do not read `.compound-engineering/config.yaml`. `docs/learnings/` is the packet you would zip and hand to a client.

## Write boundary

Only this conversation writes product files. Do not dispatch writers. Subagents, if used, are read-only.

## Procedure

1. **Extract** the problem and the fix from this session. Before asserting how code behaves, Read the defining line in the current tree. Cite PR numbers over bare SHAs. Phrase unmerged work as pending.

2. **Classify** against `references/schema.yaml`. Pick track (bug vs knowledge) from `problem_type`. Sample existing files under `<root>/*.html` and reuse their `component` / `root_cause` spellings when the area or cause already exists (corpus-first). Use schema `suggested_values` only when the corpus has no value for that area or cause.

3. **Path.** Filename is descriptive kebab-case, no category folder. If that exact path exists and covers the same problem, update it and set `last_updated: YYYY-MM-DD`. Otherwise choose a distinct filename.

4. **Write** HTML. Put YAML frontmatter in an HTML comment at the top of the file, then the page. Required fields from the schema; bug track also needs `symptoms`, `root_cause`, `resolution_type`. Quote array items that start with a YAML indicator (`` ` [ * & ! | > % @ ? ``) or contain `: `.

   Skeleton (`CSS_HREF` is `../assets/sage-docs.css` from `docs/learnings/`):

   ```html
   <!doctype html>
   <html lang="en">
   <meta charset="utf-8">
   <meta name="viewport" content="width=device-width, initial-scale=1">
   <title>SHORT TITLE</title>
   <link rel="stylesheet" href="../assets/sage-docs.css">
   <!--
   ---
   module: ...
   date: YYYY-MM-DD
   problem_type: ...
   ---
   -->
   <body>
   <nav><a href="../index.html">Docs</a></nav>
   <h1>SHORT TITLE</h1>
   <p class="lede">What broke, what you do instead, in two sentences.</p>
   ```

   First screen, in this order:
   - Bug: the problem, the fix, what would go wrong if you skipped it.
   - Knowledge: the rule, when to apply it, what goes wrong if you ignore it.

   Everything else in `<details>`: symptoms, what you tried, prevention, examples. Do not lead with background.

5. **Hub.** Add a list item on `docs/index.html` under Learnings: `<li><a href="learnings/<slug>.html">title</a></li>`.

6. **Validate** (required, from this skill's directory):

   ```bash
   python3 "<SKILL_DIR>/scripts/validate-frontmatter.py" "<doc-path>"
   python3 "<SKILL_DIR>/scripts/validate-doc-claims.py" "<doc-path>"
   ```

   Frontmatter failures are hard: fix and re-run until OK. Claim flags are adjudication, not auto-fail. Fix typos, mark historical citations, or confirm intentional. Scaffold (`Learning 3`, bare `{{...}}`) always fix. Re-run until clean or every remaining flag is intentional.

7. **Vocabulary (optional).** If `docs/concepts.html` exists, add or refine terms introduced by this learning. Do not create it unless the learning itself coined a term the next agent would misuse.

## Completion

```
Documentation complete
File: docs/learnings/<slug>.html
```

If nothing was written: `Documentation skipped` plus the reason.
