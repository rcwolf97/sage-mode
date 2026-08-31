# Conformance — implemented code vs. architecture-v3

**Checked:** 2026-08-31 · **Target:** `plugin/` at `8788f86` + working tree · **Against:** [architecture-v3](./architecture-v3.html) §1–§13
**Method:** every numbered claim in v3 read against the file that would implement it — `lib/*/index.ts`, `hooks/hooks.json`, `hooks/hooks-claude.json`, `skills/*/SKILL.md`, `agents/*.md`, `profiles/*.json` — not against the summary docs.

> **In plain terms:** Conformance is high — roughly 90% of v3's mechanics are implemented, several of them better than v3 specified. The gaps are three: two coordination hooks in §10 that were never registered, one cross-session dedup rule that exists as prose but not as code, and the fact that the shipped product is about twice the size of the thing v3 describes. Nothing is missing that would surprise you; the surprising part is what got added.

---

## 1. Scorecard by section

| § | Claim | Status |
|---|---|---|
| **2** | Commands not routing; sprint as unit; judgment metered / production free; evidence over assertion | ✅ all four |
| **3** | Eight commands + two support skills | ⚠️ **17 commands shipped** — see §3 below |
| **4** | Nine roles, models per role | ✅ + 7 design roles added |
| **5** | Three lanes, `claude -p` wrapper, budget discipline | ⚠️ mostly — two deviations, §4 below |
| **6** | The eight-command flow | ✅ every command, as described |
| **7** | Preamble split: keep 826 unique, move ~425 portable to a rule | ✅ better than spec'd |
| **8.1** | Content-addressed test freshness | ✅ + hardened past gstack |
| **8.2** | Pre-emit verification gate | ✅ + a `cannot_verify` escape hatch v3 didn't have |
| **8.3** | Finding schema, fingerprint, dedup, +1 confidence boost | ⚠️ cross-session half is prose-only |
| **8.4** | Scope gating, `SCOPE_ERROR=unmatched`, self-tuning roster, `NEVER_GATE` | ✅ — thresholds retuned |
| **8.5** | Fix loop: AUTO-FIX/ASK, batch into one question, 3 cycles | ✅ |
| **8.6** | QA loop + WTF-likelihood circuit breaker | ✅ + **materially better than v3** |
| **8.7** | Fail-closed gates, no default path to PASS | ✅ |
| **8.8** | `DIFF_START`/`DIFF_END` injection defence | ✅ + lint enforces it |
| **8.9** | Canonical recommendation line | ✅ |
| **8.10** | Dispatch mechanics | ✅ |
| **9** | Five hooks, polarity rules | ✅ six shipped — one Claude Code gap |
| **10** | Sprint dir layout; `subagentStop` chaining; `postToolUse` ledger injection | ❌ **both coordination hooks missing** |
| **11** | Repo layout, six `lib/` modules | ✅ twelve shipped |
| **12** | Build order, phases 0–6 | ✅ all phases have shipped artifacts |
| **13** | Seven open questions | ⚠️ one resolved, six still open |

---

## 2. What is missing

### 2.1 §10's two coordination hooks were never registered — the only outright omission

v3 §10 states:

> *"`subagentStop` returns a `followup_message` so the manager auto-chains the next node. `postToolUse` returns `additional_context` so the ledger state is injected right after a Task returns, keeping the manager oriented without re-reading files."*

Neither exists.

`hooks/hooks.json` (Cursor) registers `sessionStart`, `beforeShellExecution`, `preToolUse`, `afterFileEdit`, `subagentStart`, `stop`. **No `subagentStop`. No `postToolUse` at all.** `hooks/hooks-claude.json` registers `PostToolUse` but only for `sage-lane-after`, and says in its own header comment that `SubagentStop` is *"intentionally left unregistered … no sage-mode hook currently has a real use for it."*

**What this costs.** Both hooks were the automation in the build loop. Without them:

- The Eng Manager does not auto-chain. It must notice a node finished and call `sage board next` itself, every time — a manual turn per node, in the exact phase v3 designed to run unattended.
- Ledger state is not injected after a Task returns. The manager re-reads files to stay oriented, which is the token cost §10 said this hook removes.

`sage-build/SKILL.md` compensates with prose (`Run \`sage board next\``) and the ledger is genuinely disk-authoritative — so nothing is *broken*. But `/sage-build` is now a loop you drive, not one that drives itself, and that is a different product from the one §10 describes. This is the single largest design-to-code gap in the repo.

### 2.2 §8.3's cross-session dedup is an instruction, not a mechanism

v3: *"Cross-session dedup suppresses previously-skipped findings only if the file hasn't changed — never `fixed` ones, since those can regress."*

The rule is written correctly in `skills/sage-review/SKILL.md` line 104. It is **not in `lib/review/index.ts`** — no `skipped` handling, no prior-run state, no file-change check. Within-run dedup (fingerprint collapse, `MULTI-SPECIALIST CONFIRMED`, `+1` confidence) is fully implemented in code; the across-run half depends on a model following prose.

That inverts the repo's own stated posture. Every other §8 mechanic was moved from prose into a library specifically so it could not be skipped. This one wasn't, and nothing in the test suite would notice.

### 2.3 §5's Lane B consult is narrower than specified

v3 §5's worked example:

```bash
--allowedTools "Read,Grep,Glob,Bash(git diff *),Bash(git log *)"
```

Shipped (`lib/consult/index.ts:265`): `"Read,Grep,Glob"` — no git access at all.

Tighter is defensible, but the Architect consult is the one that turns a spec into a DAG, and it can no longer read `git log` or `git diff` to see how the codebase actually changes. That is a real capability loss for the exact task Lane B exists to do. Either restore the two scoped Bash patterns or record why they were dropped.

Related: v3 is emphatic that `--bare` must never be passed, because bare mode bypasses subscription login and reverts to metered API billing. The code never passes it — but there is **no comment, guard, or test asserting that invariant**. It is currently true by accident of what someone typed, not by construction. One line in `test/consult.test.ts` fixes that.

### 2.4 Six of seven §13 open questions are still open

| Q | Status |
|---|---|
| 1. `preToolUse` `file_path` for Write | **Open.** SPIKE-01 harness is currently installed and has captured payloads — but all three are synthetic (see §5 below). |
| 2. Plugin subagents honor `model:` | **Open.** SPIKE-02 probes installed, no dispatch recorded. |
| 3. How hard do Lane B limits bite | **Open.** No consult volume data exists. |
| 4. Is `gemini-3.7-flash` a good adversarial reviewer | **Open.** The A/B was never run. |
| 5. How long is a sprint really | **Open.** Zero sprints run. |
| 6. Cursor CLI parity | **Open.** Untested. |
| 7. Does the Lane B window survive Product | ✅ **Resolved.** `product_mode: hybrid` is implemented in `sage-shape/SKILL.md` — interrogation on Lane A, premise challenge and drafting on Lane B, warn once and never silently. |

---

## 3. What was added that v3 never described

This is the larger story. v3 describes a plugin with **8 commands, 10 roles, and 6 `lib/` modules**. What shipped:

| | v3 | Shipped |
|---|---|---|
| Commands | 8 | **17** |
| Agent cards | ~9 | **19** |
| `lib/` modules | 6 | **12** |

**An entire design organization that appears nowhere in v3.** Six commands (`/design-intake`, `/design-direction`, `/design-system`, `/design-motion`, `/design-build`, `/design-critique`), seven agent cards (director, art-director ×3 mandates, strategist, technologist, motion, critic), an anti-slop rubric and an accessibility pass. `grep -ic "design-intake|design-direction|art director|design-critique" architecture-v3.md` returns **0**. This is a second product living in the same plugin, governed by a separate design doc (`design-org.md`) that the architecture of record does not reference.

**Three operational commands v3 never mentions:** `/sage-setup`, `/sage-status`, `/sage-unsafe`. All three are obviously correct — you cannot ship an installable plugin without setup, and `/sage-unsafe` is the audited escape hatch for `sage-careful`. They are additions, not deviations.

**Six `lib/` modules v3 never mentions:** `egress` (per-dispatch ledger of what left the machine, hash-chained and verifiable), `redact` (secret-stripping before any payload crosses a process boundary), `manifest` + `setup` (install tracking with preserve-on-modify), `lint` (sage-mode's own conventions), `recall` (BM25). `egress` and `redact` in particular are a privacy posture v3 never asked for and none of the three reference plugins have.

**The honest read:** the additions are good work, and most are load-bearing. But v3 is no longer an accurate description of the product. Someone reading it to understand what sage-mode *is* would be roughly half wrong on surface area — and `/sage-shape`, the front door, now shares a plugin with a design org it has no relationship to.

---

## 4. Where the implementation beat the spec

Worth recording, because these are the places the code thought harder than the design did.

**§8.6 WTF circuit breaker — mechanically derived, not self-reported.** v3 gives the formula (+15% per revert, +5% per >3-file fix, +1% after fix 15, +10% all-low-severity, +20% unrelated files, stop at >20%, hard cap 50). The obvious implementation asks the agent for the number. `lib/board/index.ts` instead derives every input from git — reverts identified by git's own `Revert "..."` subject or `This reverts commit <sha>` trailer, never free text an agent could fabricate — and the code carries an explicit note that the old self-report parse *"is replaced: from here on, `l.wtf` must only ever be set from"* the derived value. A circuit breaker the runaway agent can lie to is not a circuit breaker.

**§8.1 evidence — the gitignore self-invalidation guard.** `checkSageIgnored()` detects that sage's own writes under `.sage/`/`.worktrees/` would land between the pre- and post-run fingerprint snapshots and permanently poison freshness, and fails loud with the exact `.gitignore` lines to add. Not in v3, not in gstack.

**§8.2 — the `cannot_verify` outcome.** v3's gate caps any finding without a quoted line at confidence 5. That is right for hallucinated findings and wrong for findings whose evidence *cannot* be in the diff (a missing migration, an absent test). The code adds a third classification that routes those to ASK, exempt from the evidence cap but never auto-fixed. That is a genuine improvement on gstack's design.

**§5 — the Lane B model receipt.** v3 asked for `total_cost_usd`. `extractModelReceipt()` also parses `modelUsage` and returns `verified: false` when the field is absent — never upgrading silence to success. `/sage-retro` reports the count of unverified consults as a drift signal.

**§9 — six hooks, not five.** `sage-lane-after` ships built and unregistered, purely so the SPIKE-01 FAIL branch is a one-line config change instead of new engineering. Building the fallback before knowing you need it is the right call.

**§7 — 161 lines, not 425.** The conduct rule is denser than the plan and covers more (plan mode, context health, completion status, repo ownership, search-before-building — none of which v3 enumerated).

---

## 5. Two things to fix immediately

### 5.1 The SPIKE-01 payloads are synthetic — do not read them as a PASS

`plugin/tools/spikes/spike-01-write-path/out/verdict.txt` currently contains three blocks, and the first reads:

```
VERDICT: file path WAS exposed, via: tool_input.path='/tmp/synthetic-path.ts'
```

**This is not a live Cursor capture.** All three payloads carry the identical timestamp `2026-08-31T08:13:20Z` — same second — and their contents are `/tmp/synthetic-path.ts`, `{}`, and `{"file_path":"/tmp/after-edit.ts"}`. These are three hand-crafted payloads piped into the probe to test *the probe*. A real Cursor `preToolUse` payload carries `conversation_id`, `generation_id` and `workspace_roots` alongside `tool_name`/`tool_input`; none of the three has them.

The harness is validated — it correctly identifies a path when one is present and correctly reports absence when it is not. **SPIKE-01 itself is still unanswered.** It would be very easy to skim that file next week and conclude the spike passed. Delete or clearly label those three blocks before they get mistaken for evidence.

### 5.2 Uncommitted spike state is live in the working tree

`hooks/hooks.json` and `hooks/hooks-claude.json` currently carry a probe entry with a **hardcoded absolute path**:

```
/Users/rcwolf/Desktop/Projects/cursor-plugins/sage-mode/plugin/tools/spikes/spike-01-write-path/probe-hook
```

Three `zz-spike02-*.md` probe cards are also live in `agents/`, and `hooks/*.spike01-orig` backups are sitting beside the manifests. All of this is expected mid-spike and all of it is uncommitted — but that absolute path must never reach a commit, since it would break every install that is not on this machine.

```bash
cd plugin
./tools/spikes/spike-01-write-path/uninstall.sh
./tools/spikes/spike-02-subagent-model/uninstall.sh
git diff --stat plugin/hooks/     # must be empty before committing
```

---

## 6. Verdict on conformance

**The mechanics conform. The surface does not.**

Every load-bearing mechanism v3 specified is implemented, and five of them are implemented better than specified. If you asked "did they build the thing they designed," the answer for §5 through §9 is yes, with two narrow exceptions (§8.3's cross-session half, §5's consult tool allowance).

§10 is the real gap: the two hooks that made `/sage-build` self-driving were never registered, so the build loop is manual in a way the design says it should not be. That is worth fixing before the first real sprint, because the first real sprint is where you will feel it.

And v3 is now roughly half a description of the product. Either fold the design org and the operational commands into a v4, or split the design org into its own plugin. Right now the architecture of record does not describe what a user installs.
