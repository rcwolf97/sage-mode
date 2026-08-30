# Adversarial Re-Review — sage-mode v1, post-fix

> **Update, same day.** F1 (the character-class/`?` false negative in `lib/dag`), F2 (CI running a narrower test set than `npm test`), and F8 (the README's broken install path) were fixed immediately after this review, verified against the exact adversarial cases below plus a real CLI-level reproduction, and redeployed. The sections below (§2.3, §2.4, §3, §6 items 2/3/5) describe the state **as found**, not the current state — left as written because the finding, the reproduction, and the fix are worth keeping intact as a record. F3–F7, F9, and the two unrun platform spikes remain open exactly as described.

**Reviewed:** 2026-08-24 · **Target:** `/root/fix/plugin` (the exact content deployed to the owner's project) · **Baseline:** [`build-review.md`](./build-review.md), against `bb36690`
**Method:** independent re-execution of every claimed verification command, hand-crafted adversarial payloads against all five hooks under both `dash` and `bash`, direct probing of `lib/dag`'s glob engine with pairs not in its own test file, a full read of `tech-spec.md`, a section-by-section cross-check against the fix pass's own claims, and a full read of 6+ skills and 6+ role cards for content quality, not just line count.

> **In plain terms:** The fix pass did real, verifiable work — the three original blockers are substantially closed, the hooks genuinely work under `dash` now, and I could not break the specific false-negative shapes the first review named. But I found a new false negative in the exact same mechanism (D2, the lane-intersection check) using glob syntax the fix pass's own test suite never tried, a CI workflow that silently runs a narrower test set than `npm test` does, and a catalog of 25 "skills" that are one template with the names swapped in — not the by-the-original-review-standard "outline instead of a procedure" but something one level worse: no procedure at all, just a shape. None of this is a redesign. It's installable and testable today with the caveats below understood.

---

## 1. Verdict

**Ready with caveats.** This is safe to install and start using on a real project this week, on the condition that the owner reads §5 below before relying on parallel `/sage-build` dispatch with anything but simple trailing-`**` glob lanes, and treats the two platform spikes as unrun (because they are).

| | Original review | This review |
|---|---|---|
| B1 — hooks broken on Linux | Broken (dead under `dash`) | **Fixed and independently verified**, including under adversarial payloads not in the original fixture set |
| B2 — lane-intersection false negatives | Broken (4/8 named cases missed) | **The 4 named cases are fixed.** A different false-negative class (POSIX character classes, `?`) is not — found independently, reproduced end-to-end at the CLI |
| B3 — skills/role cards are outlines | Broken (empty `references/`, 42-line `sage-shape`) | **Substantially fixed for the spine skills and role cards** (read in full, genuinely good). **Not fixed for the 25-skill catalog** — uniform 34-line template stubs |
| CI never green | 3 failing tests on `main` | **41/41 pass when run as the fix pass ran them** — but the actual CI workflow file runs a narrower 37-test set that silently excludes the M8 regression tests |
| Blocking spikes (SPIKE-01/02) | Never run | **Still never run.** No `docs/spikes/*.md` exists. Sensible fallback defaults are coded for both, but the two assumptions the whole cost/parallelism architecture rests on remain empirically untested against real Cursor |

---

## 2. What I independently verified, and how

### 2.1 Build, unit tests, lint, tier 3 — re-run from scratch, not trusted

```
$ npx tsc -p .
(clean, no output)

$ node --test --test-reporter=spec test/*.test.js lib/**/*.test.js
...
ℹ tests 41
ℹ pass 41
ℹ fail 0
ℹ duration_ms 8573.3

$ node lib/cli.js lint
ok

$ node evals/tier3/run.js
7 passed, 0 failed, 1 skipped (of 8)
```

The tier-3 skip ("Reviewer handed a clean diff") is honest, not a dodge: its own printed rationale is that "no invented findings" is a claim about what a *live* reviewer subagent does with a real diff, and this sandboxed runner cannot invoke one — a synthetic empty-findings-list input would pass trivially without exercising anything. I agree with that assessment; it isn't fixable without a live Cursor session, which nothing in this environment can provide.

### 2.2 Hooks — dash and bash, plus payloads the fixture set doesn't have

`bash hooks/tests/run.sh` passes every fixture under explicit `dash` and `bash` invocation (confirmed: `test [/usr/bin/dash] sage-solo ...  ok` for all five hooks, all six required categories from §7.1 rule 6 — normal allow, normal deny, malformed, BOM, empty, quote+newline — present for every hook). I then wrote my own adversarial payloads beyond the shipped fixtures and ran them directly against each hook under both interpreters:

- **BOM + embedded newline in one command**, **nested `eval`/subshell obfuscation**, **base64-piped-to-bash** — all correctly fell to the ask-tier or the obfuscation tripwire under both `dash` and `bash`. No divergence between interpreters on any payload I tried.
- **`sage-lane`**: relative `../` escape, `../` that returns back in-lane, `../` that escapes and lands in a different out-of-lane directory, an absolute path entirely outside the project, the `filePath` key variant, and a `null` `tool_input` — all handled correctly under the `python3` branch **and** under a `PATH` rigged to expose only `node` (forcing the fallback branch). Both interpreters agree.
- **`sage-solo`**: a stale `.sage/parent-role` marker is read exactly once and deleted immediately, confirmed by checking the file no longer exists after the hook runs — this is the fix for M2 (the original review's "stale marker denies every future subagent spawn forever" bug), and it holds.
- **`sage-careful`**: `rm -rf "/"` , `rm -rf '/'`, `rm -rf ///`, `rm -rf /.`, `rm -rf ${HOME}`, and `rm -rf $HOME/` all fall through the HIGH-deny tokenizer to the MEDIUM ask tier rather than a hard deny — a gap in the token-exact-match list, not a fail-open (ask-tier hooks are specified to never `failClosed`, so this degrades to "confirm," not "allow silently"). Listed as a minor finding in §5, not a blocker.

### 2.3 `globIntersect` — the finding that matters most

The original review's B2 table (`src/*.ts` vs `src/api.ts`, `src/**/*.ts` vs `src/api/foo.ts`, `**/*.test.ts` vs `src/api.test.ts`, `src/api/**` vs `src/**/*.ts`) is genuinely fixed. I reproduced all four independently — both by calling `globIntersect` directly and via `sage dag lanes` at the CLI — and they now correctly report an intersection.

I then went past that table with my own adversarial pairs, per the task's explicit instruction to try character classes, `?`, and doubly-wildcarded segments. Two of these reproduce a live false negative:

```
$ node -e "... globIntersect('src/[ab]*.ts', 'src/api.ts', tree) ..."
=> false   (real answer: true — 'a' is inside the class [ab])

$ node -e "... globIntersect('src/a?.ts', 'src/ab.ts', tree) ..."
=> false   (real answer: true — '?' matches exactly one char, 'b')
```

This is not a synthetic empty-tree corner case — I built a real repo with `src/api.ts` and `src/ab.ts` actually committed, and `expandAgainstTree` returns `[]` for both wildcarded sides even though the tree contains an exact match. Root cause, read directly in `lib/dag/index.ts`: `globToRegExp` and `segmentRegExp` **escape `[` and `]` as literal regex characters** (no character-class support at all) and **don't special-case `?`** — it falls through to the "else insert literally" branch, where `?` is a live regex metachar (zero-or-one of the preceding character), silently making whatever precedes it optional rather than matching a single character.

Reproduced end-to-end at the exact CLI surface the owner will actually run:

```
$ cat dag.json   # n1 owns ["src/[ab]*.ts"], n2 owns ["src/api.ts"], same wave
$ node lib/cli.js dag validate dag.json
ok
$ node lib/cli.js dag lanes dag.json --wave 1
ok
```

Both come back clean. Two nodes with genuinely overlapping `owns` are scheduled into the same wave. This matters because `hooks/sage-lane` — the runtime enforcement — implements globs *correctly*: its Python branch uses `fnmatch.fnmatch` (which does support `[...]` and `?`) and its Node branch has its own from-scratch char-class parser that also gets it right. I confirmed this directly: with `.sage/lane` set to `owns: ["src/[ab]*.ts"]`, writing `src/api.ts` is **allowed** by the hook (correctly, per real glob semantics) under both interpreter branches. So at dispatch time, node A (whose lane genuinely covers `src/api.ts` via the character class) and node B (whose lane is exactly `src/api.ts`) can both be told by `sage dag lanes` that they're safe to run concurrently, and then both permitted by `sage-lane` to write the same file — the precise split-brain scenario D2 exists to prevent, reproduced from schema-authoring time through to runtime enforcement.

The schema's own field description (`schemas/dag.schema.json` / tech-spec §5.3) calls `owns` "POSIX glob patterns" without qualification — character classes and `?` are standard POSIX glob syntax, not an exotic extension, and the runtime hook already implements them. This is a real, live gap in the single most safety-critical mechanic in the system, found by testing glob shapes the fix pass's own regression table (which is thorough on wildcard *position* but never touches wildcard *character class*) doesn't cover.

*(The "both sides wildcarded, different literal parts" case — e.g. `src/**/*.ts` vs `src/**/*.js` — does resolve to a false positive, not a false negative, via the documented "conservative true" fallback in `segmentCompatible`. That's the safe direction and matches the spec's explicit preference; it's a known, honestly-commented limitation, not a bug.)*

### 2.4 CI vs. what actually gets tested

`package.json`'s `test` script is `node --test --test-reporter spec test/*.test.js lib/**/*.test.js` (41 tests). `.github/workflows/ci.yml` (which lives at `/root/fix/.github/workflows/ci.yml`, one level above `plugin/`) does not call `npm test` — it inlines `node --test --test-reporter spec test/*.test.js`, omitting `lib/**/*.test.js` entirely:

```
$ node --test --test-reporter=spec test/*.test.js   # what CI actually runs
ℹ tests 37
ℹ pass 37
```

The four tests CI silently skips are in `lib/consult/index.test.js` and, more importantly, `lib/lint/index.test.js` — which contains exactly the two regression tests for M8 from the original review (the lint-floor fix: "lint FAILS a stub SKILL.md well under its line floor... (previously passed)" and "lint PASSES a substantive SKILL.md..."). A future regression in the lint-floor logic would not be caught by the CI as it's actually configured, even though the test exists and passes when run by hand. This is exactly the kind of process gap the original review's closing note warned about ("test your code against the cases you expect to fail") — reproduced one level up, in the CI wiring itself rather than in a hook.

### 2.5 Content quality — read, not counted

I read `sage-shape/SKILL.md` (409 lines) in full: genuinely excellent. It carries the actual forcing-question text, real bad-answer/follow-up pairs for all seven topics, a fully worked demand-test table with a cost-to-give heuristic, worked premise-challenge examples, worked alternatives examples, an 18-row rationalization table that reads as observed rather than invented, and a red-flags list specific to intake failure modes. It correctly never restates conduct — it references `rules/sage-conduct.mdc` by name for the decision-brief format and anti-sycophancy rule rather than re-deriving them. This is a real fix, not padding to hit a line count; it's still short of the spec's ~830-line target, but what's there is substance.

I read `reviewer.md`, `implementer-backend.md`, `architect.md`, and `design-director.md` in full: all four have a real Scope paragraph (what the role does and explicitly does not do), a concrete Checklist, and a stated Output contract — a material improvement over the original 3-sentence stubs, and well within the 80-line cap while using it more fully (19–29 lines vs. the original 7–13).

I read the catalog in full (`migration-safety`, `security-audit`, plus spot checks). All 25 files in `skills/catalog/` are **exactly 34 lines**, byte-identical in structure, differing only in `name`, `description`, and the substitution of the `applies_when` string into two spots — including a spot where that substitution produces a grammatically broken sentence in every single file: *"'I'll skip the artifact, I looked already' → auditing auth, sessions, or trust boundaries. Size is not the filter."* (for `security-audit`; the same pattern repeats identically for all 25). There is no actual domain content anywhere in the catalog — no expand-contract/lock/backfill mechanics in `migration-safety`, no authn/authz/injection/secrets substance in `security-audit`. This is not "thin," it's a template with the topic name swapped in, and it directly contradicts §8.9's claim that catalog content "is straightforwardly adapted from agent-skills."

I checked `design-intake/SKILL.md` (98 lines) against `sage-shape`, since the spec explicitly names both as the only two skills capped at 900 lines "because the interrogation content is the skill." `design-intake` has **no `references/` directory at all** (not empty — absent), no worked examples, no evasive-answer-handling depth. It does correctly cover every required topic from spec §10.3 (purpose/stakes, specific person, before/after, the two-word-tension test, three admired-with-specifics, three anti-references, the friend test, brand assets, constraints, content reality, success signal), so it's a real skill, just a noticeably thinner one than its named peer.

---

## 3. Findings the fix pass missed or only partially closed

Ordered by how much they matter to "safe to run on a real project."

### F1 — `lib/dag`'s glob engine has a live false negative on POSIX character classes and `?` (see §2.3)

**Severity: real, load-bearing, but narrow in practice.** Most Architect-authored `owns` globs will be simple trailing-`**`/`*` shapes, which the fix correctly handles. But an LLM-authored glob excluding a pattern (`src/[!_]*.ts`, `src/file-?.ts`) is entirely plausible, and when it happens, the exact safety guarantee D2 exists for silently does not hold — verified end to end through the real CLI surface, not a unit-test artifact. **Fix is small**: implement real `[...]` and `?` translation in `globToRegExp`/`segmentRegExp`, mirroring what `hooks/sage-lane`'s own two implementations already do correctly. Add the two cases above (plus a negative-class case, `[!ab]`) to `lib/dag/index.test.ts`.

### F2 — CI silently runs a narrower test set than `npm test` (see §2.4)

**Severity: process risk, not a live bug today** — the excluded tests currently pass. But it means the CI green checkmark does not mean what the repo's own `package.json` says "test" means, and the specific tests excluded are the M8 regression tests from the original review. **Fix is one line**: `.github/workflows/ci.yml` should call `npm test`, not a hand-inlined subset of it.

### F3 — The 25-skill catalog is a single template, not adapted content (see §2.5)

**Severity: reduces value, doesn't create risk.** `sage recall` will successfully route a query to `migration-safety` or `security-audit` by name and description — the retrieval mechanism (Tier 2 eval, ≥80% rank-1, passes) works fine — but the skill it hands back has nothing in it. This is the largest single piece of the original B3 finding that the fix pass did not actually close, despite the unification pass's own report reportedly flagging catalog thinness as a known issue (per the task background) — it went unaddressed rather than fixed.

### F4 — `design-intake` was not given the same attention as its named peer `sage-shape` (see §2.5)

**Severity: moderate.** The design org's front door is functional and covers every required topic, but is missing the depth (`references/`, worked examples, evasive-answer patterns) that makes `sage-shape` genuinely good. Since `/design-intake` gates all downstream design work exactly the way `/sage-shape` gates all downstream engineering work, this asymmetry is worth closing before leaning on the design commands specifically.

### F5 — The two blocking spikes were never run; no `docs/spikes/*.md` exists anywhere

**Severity: the most consequential unresolved item, structurally.** `find /root/fix/plugin/docs -iname "*spike*"` returns nothing. Both SPIKE-01 (does `preToolUse` expose `file_path` for `Write`?) and SPIKE-02 (do plugin-shipped subagents honor `model` frontmatter?) remain empirically untested against real Cursor. The design scorecard (`scorecard.md`) flagged these as the two scores resting on unverified assumptions and said explicitly: *"If the second assumption is wrong, lane enforcement isn't buildable and parallel throughput drops to about a 5. Both are an hour of testing."* That hour still hasn't happened. To the fix pass's credit, both fallback paths are coded defensively regardless of outcome: `hooks/sage-lane-after` (the detect-and-revert fallback for SPIKE-01) exists and is not double-registered in `hooks.json` (the original M3 issue is fixed), and `/sage-setup` unconditionally copies role cards into `<project>/.cursor/agents/` (the SPIKE-02 fallback), verified directly in `lib/setup/index.ts`. So the system is unlikely to be silently broken either way — but the owner is about to be the first person to actually find out, and should treat that as the literal first thing to check, not an afterthought.

### F6 — `sage evidence run|check` still has no `--sprint` flag at the CLI layer

The library groundwork is real: `activeSprintDir(root?, sprintId?)` in `lib/evidence/index.ts` now accepts an explicit sprint id, with a code comment candidly noting *"lib/cli.ts does not yet thread an explicit sprint through here."* Confirmed: `lib/cli.ts` exposes `--sprint` for `sage board *` but not for `sage evidence run|check`. User-visible behavior is unchanged from the original review's minor finding — `evidence check` still silently reads whichever sprint directory sorts lexicographically last. Low-stakes in the common single-active-sprint case; matters once retro or a resumed session spans more than one sprint at a time.

### F7 — `sage-careful`'s HIGH-deny tokenizer misses quoted/braced/multi-slash variants of its own protected patterns (see §2.2)

Degrades to "ask," never to silent allow, so this is a robustness gap rather than a safety hole — but `rm -rf "/"` and `rm -rf ${HOME}` are exactly the kind of thing a copy-pasted or LLM-generated command produces. Worth tightening the tokenizer to normalize quotes and braces before the token-set comparison.

### F8 — README's documented install path doesn't work from what the owner actually has

`plugin/README.md`'s first instruction is "Installed via the marketplace at the repository root (`.cursor-plugin/marketplace.json` → `"source": "plugin"`)." That file exists — but at `/root/fix/.cursor-plugin/marketplace.json`, one directory *above* `plugin/`, not inside it. Per the task background, what's "deployed to the owner's actual machine" is `plugin/` itself. The README, which ships inside `plugin/`, points to a file that isn't inside the folder it ships in, and never mentions the symlink method (`ln -s "$PWD" ~/.cursor/plugins/local/sage-mode`) that tech-spec §4.3 calls the normative development-install path. Someone starting from exactly what the task says the owner has would not be able to follow the README's own first line without already knowing to look one directory up.

### F9 — `design-system` references a query mechanism (`--domain ux/a11y`, `--stack <name>`) that isn't implemented anywhere in this repo

Per spec §10.5, this is meant to hit ui-ux-pro-max's 22-CSV BM25 tool. Nothing in `sage-mode` vendors that data, implements that query command, or declares ui-ux-pro-max as an install prerequisite (checked `README.md`, `.cursor-plugin/plugin.json`) — it's a dangling reference to a capability the shipped repo doesn't have.

### What I looked for and did not find a problem in

Both blockers B1 (hooks) and B2 (the four originally-named glob shapes) are genuinely fixed, independently re-verified with payloads beyond the shipped fixtures, not just re-run. M2 (stale `parent-role` marker) is fixed and its self-cleaning behavior confirmed directly. M3's double-registration half is fixed (only `sage-lane` is wired into `hooks.json`; `sage-lane-after` exists but isn't simultaneously active). Schemas (5) and test fixtures (5) match 1:1. `rules/sage-conduct.mdc` correctly holds the cross-cutting behavior, and a repo-wide grep found no skill restating it. `sage-shape`, the four role cards I read in full, and the review/evidence pipeline (`lib/review`, `lib/evidence`) all hold up under direct code reading, not just their own tests passing.

---

## 4. Sample work-package acceptance checks

- **WP-06 (`lib/evidence`)** — "All §11.1 evidence cases pass, including the index-immutability assertion." Confirmed: `wtree does not mutate the real .git/index` passes, byte-identity asserted directly in the test.
- **WP-08 (`lib/dag`)** — "Rejects a cycle, `owns: ["**"]`, and an intersecting wave." The first two hold (tested directly). The third holds for every glob shape in the original table but **not** for character-class/`?` shapes — see F1.
- **WP-13 (`/sage-review`)** — "Planted-bug and clean-diff evals both pass." Only half-true as measured: the planted-bug case passes; the clean-diff case is **skipped**, honestly, because it requires a live specialist subagent this sandbox can't invoke. The acceptance criterion as literally written ("both pass") is not actually satisfiable outside real Cursor — worth knowing before reading a "23/24 acceptance criteria met" summary as more settled than it is.
- **WP-15 (hooks)** — "Every §11.2 case passes on macOS and Windows, including the BOM fixture." Verified for Linux (`dash`/`bash`) directly; Windows and macOS are unverifiable from this environment, same as the original review's limitation.
- **WP-16 (parallel worktrees)** — `sage dag worktree` implemented and present in `sage-build/SKILL.md`'s procedure with `is_background: false` pinned per the spec's explicit instruction; not runnable end-to-end without live Cursor, same caveat as F5.
- **WP-24 (packaging)** — "A fresh machine reaches 'roadmap rendered' in under fifteen minutes from the README alone." Untestable as literally written per F8 — the README's own first instruction doesn't resolve to a file that exists inside what ships.

---

## 5. Five-repo comparison — what actually changed now that this is built

The design-time scorecard (`scorecard.md`) gave sage-mode's *design* a 9 on review rigour, a 9 on mechanical enforcement, a 10 on cost control, and flagged the two Cursor-platform assumptions as the load-bearing unknowns. Assessing the *built* repo against the same five systems, not the design document:

**Beats gstack on mechanical enforcement portability, ties it on review-pipeline correctness, loses to it on proven depth.** gstack's hooks are bash-only and its subagents pin no model at all — sage-mode's hooks now genuinely work under `dash`, independently verified, which gstack's own don't need to because gstack never targeted POSIX portability. `lib/review`'s confidence gate and dedup-with-boost are faithful, mechanically-enforced ports of gstack's mechanism and pass under direct testing. But gstack's 14-phase OWASP+STRIDE security audit and its specialist roster are real, field-used content refined against actual review traffic; sage-mode's `security-audit` catalog entry (§2.5/F3) has never seen a real diff and currently contains no security content at all. **Honest loss:** gstack's review depth is proven; sage-mode's pipeline is well-built but its content is, in the one place I checked closely, empty.

**Beats superpowers on cost architecture and enforcement, loses to it on rationalization-table provenance.** Superpowers has zero model tiering and its enforcement is textual, one hook. Sage-mode's three-lane cost architecture is real code (`lib/consult`, verified: refuses untrusted roots, never passes `--bare`, reports `rate_limit` rather than retrying silently) where superpowers has none. But superpowers' rationalization tables are explicitly built from excuses *observed during actual adversarial pressure-testing over time* — the tables I read in `sage-shape` and the catalog are well-written but invented in a single fix-pass sitting, not harvested from real runs, which is precisely the distinction tech-spec §13.1 itself draws ("An invented table is decoration; `/sage-retro` is what keeps them real"). **Honest loss:** sage-mode's tables read as good as superpowers' today; they aren't actually the same kind of artifact yet, because nothing has run.

**Beats compound-eng's memory design (indexed vs. flat-unindexed), unverified in practice.** `lib/recall`'s dedup-before-write and BM25 index are real, tested code — a genuine architectural improvement over CE's documented 78-file unindexed rot. But this has never accumulated a real learning corpus; the improvement is structurally sound and completely unproven at the scale where CE's problem actually showed up.

**Loses to agent-skills on lifecycle breadth, cleanly and by a wide margin.** Agent-skills' 24 skills are real, maintainer-refined content covering observability, deprecation, ADRs, CI/CD. Sage-mode's nominal 25-skill catalog covering the same ground is, per F3, a single template — this is the one comparison in this section where the built repo is unambiguously and by a large margin worse than the reference it explicitly claims to have adapted content from (§8.9).

**Beats ui-ux-pro-max on intake depth and generic-output avoidance where the mechanism is actually implemented, but partially borrows a capability it doesn't ship.** `/design-intake` and the three-mandate `/design-direction` mechanism are real, load-bearing design (confirmed present, matches spec §10.4's restrained/expressive/structural split), a genuine answer to ui-ux-pro-max's median-output problem. But `design-system`'s references to ui-ux-pro-max's own `--domain`/`--stack` query tool (F9) point at a capability this repo doesn't vendor, implement, or declare a dependency on — so the "design knowledge without the generic output" claim is only as strong as `/design-direction`'s own mandate mechanism, not the token/a11y lookups the spec described riding on ui-ux-pro-max's data.

---

## 6. What to do before you trust this on a real project

Ordered by how much each one actually matters, not by effort to fix.

1. **Run the two spikes for real, on your own Cursor install, before dispatching a parallel `/sage-build` wave.** Write the results to `docs/spikes/SPIKE-01.md` and `SPIKE-02.md` as the spec requires. The fallback code is in place either way, but you should know which path you're actually on.
2. **Fix the `globToRegExp`/`segmentRegExp` character-class and `?` gap in `lib/dag/index.ts` (F1) before relying on `/sage-dag`'s "no overlapping lanes" guarantee for anything but simple `*`/`**` globs.** This is a two-function patch plus three test cases; it's the one finding in this review that reaches the same severity class as the original B2.
3. **Point CI at `npm test`, not the hand-inlined subset (F2).** One-line fix; otherwise a regression in the lint-floor logic (M8) could ship silently.
4. **Know that the 25-skill catalog and `design-intake`'s references are currently decorative (F3, F4)** — useful as a routing skeleton for `/sage-retro` to fill in later, not as content you can lean on today for security/migration/observability work. Don't be surprised when `security-audit` comes back with generic checklist language instead of an actual audit procedure.
5. **Fix the README's install path (F8)** before handing this to anyone else, or they'll hit the same dead end you would.
6. Everything else in §3 (F6, F7, F9) is genuinely fine to leave as a follow-up — none of it silently permits something dangerous or blocks a normal sprint.
