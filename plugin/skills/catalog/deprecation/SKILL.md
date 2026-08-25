---
name: deprecation
description: Catalog skill — sunset windows, shims, telemetry on old paths. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "removing a public API or flag safely"
---

# deprecation

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. Inventory every call site of the thing being removed — internal callers, SDKs, docs examples, and any usage telemetry you already collect. A grep that finds 12 call sites when telemetry shows 40,000 requests/day from external clients is not confirmation, it's a red flag.
2. Pick a concrete sunset date and put it in the deprecation warning itself, not just a tracking ticket — "removed after 2026-11-01" beats "removed in a future release."
3. Ship a shim that keeps the old path working but forwards to the new implementation, rather than a second copy of the old logic that will silently drift from it.
4. Add telemetry on the shim — a counter or log line per invocation — so you can watch real usage decay before you delete anything, instead of guessing from a code search.
5. Notify known callers directly: changelog entry, deprecation header, email to API key holders. Don't rely on people reading a CHANGELOG they never open.
6. When usage on the old path hits zero (or an acceptable floor) and the sunset date has passed, delete the shim in a change that also removes its telemetry and any now-dead branches.
7. Keep the failure mode actionable after removal too — a deleted endpoint should return an error pointing at the replacement, not a bare 404 with nothing.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It's an internal API, nobody outside the team calls it" | Internal APIs get called by cron jobs, dashboards, and other teams' scripts nobody remembers writing. Telemetry finds those; a single-repo code search doesn't. |
| "We announced it in the changelog, that's enough" | A changelog entry has near-zero reach against live traffic that hasn't dropped. Shim telemetry, not the announcement, is what tells you deletion is safe. |
| "The old and new paths are basically the same, I'll just delete the old one now" | If they were identical you wouldn't be deprecating one. The edge-case differences are exactly what breaks callers who haven't migrated. |
| "We'll skip the shim and just cut over" | A hard cutover with no fallback turns every straggling caller's failure into an incident on the sunset date instead of a warning weeks earlier. |

## Red Flags

- A sunset date exists only in a ticket, never shown in the deprecation warning or response users actually see
- No telemetry on the old path, so "usage has dropped" is an assumption instead of a measurement
- The shim duplicates logic instead of forwarding to the new implementation, so the two quietly diverge
- Deletion PR ships the same week as the announcement, with no observed decay period

## Done when

The old path has a dated sunset visible to callers, telemetry shows real usage at or near zero, and the shim plus its telemetry are deleted in one change with a clear pointer to the replacement.
