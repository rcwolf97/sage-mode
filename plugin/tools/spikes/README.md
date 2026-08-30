# Spike harnesses

Two open questions about how sage-mode's hooks/agents actually behave on a
live host, neither of which has been executed for real — these are
harnesses only. Nothing in this repository claims either spike has been
run or reports a result; running one and reading `out/` is a manual step
for whoever has a live Cursor or Claude Code session to test against.

- **`spike-01-write-path/`** — does `preToolUse`/`PreToolUse` expose a file
  path for a `Write` call? (`hooks/sage-lane`'s preventive deny depends on
  this; `hooks/sage-lane-after`'s `afterFileEdit`/`PostToolUse`
  detect-and-log path is the fallback if not.)
- **`spike-02-subagent-model/`** — do plugin-shipped subagents honor their
  `model:` frontmatter field? (Several real agent cards already set one,
  including some with non-Claude values that are almost certainly inert
  under Claude Code regardless of this spike's answer — see that spike's
  own README.)

Each is runnable end-to-end with one command per step (`install.sh`,
then trigger the real host action, then `read-result.sh` / fill in
`out/observations.md`, then `uninstall.sh`) — see each spike's own
README.md for the exact steps, where output lands, and how to read it.
