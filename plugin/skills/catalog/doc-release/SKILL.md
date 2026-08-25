---
name: doc-release
description: Catalog skill — changelogs, upgrade notes, deprecation windows. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "writing user-facing release documentation"
---

# doc-release

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. Diff the actual code and API changes since the last release before writing anything — the notes report what shipped, not what was planned.
2. Bucket every entry under a fixed taxonomy — Breaking, Added, Fixed, Deprecated — and never let a breaking change hide inside a vague "Improvements" section. If the taxonomy says Breaking, the version number should reflect it.
3. For every breaking change, write the upgrade note as a diff the reader can paste: old call to new call, old flag to new flag — not a paragraph describing the change in the abstract.
4. Cross-reference deprecation windows already in flight: if something is entering its sunset period, restate the date here too, not only in the code's own warning.
5. Run the upgrade steps yourself against a real checkout before publishing — a migration guide that fails on its first instruction erodes trust in the rest of the release.
6. Link each entry to the PR or issue that shipped it so a reader needing more detail than one line has somewhere to go.
7. Have someone who didn't write the code read the notes cold — if they can't tell whether it affects them and what to do, the notes have not done their job.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It's a patch release, nobody reads patch notes" | Automated dependency bots apply patch releases without a human looking first; if a patch silently changes behavior, the notes are the only place that surfaces it before it breaks a build. |
| "I'll just write 'various bug fixes and improvements'" | That line answers neither question a reader has — does this affect me, do I need to act — and fails anyone later auditing when a specific fix actually shipped. |
| "The PR title already explains it" | A PR title is written for reviewers with the diff open; release notes are read by people who have never seen the diff and don't know the feature's internal name. |
| "We'll add the upgrade guide once people start asking" | By the time people ask, they've already hit the breaking change in production unwarned — the exact outcome the note exists to prevent. |

## Red Flags

- A Breaking entry with only a description, no copy-pasteable migration step
- A deprecation window mentioned in code comments but absent from the release notes
- Entries with no PR or issue link and no way to verify what actually shipped
- The version bump doesn't match the taxonomy — a Breaking entry filed under a patch release

## Done when

Every entry is correctly bucketed against the real diff, every breaking change carries a migration snippet, and someone outside the authoring team can read the notes and know whether they need to act.
