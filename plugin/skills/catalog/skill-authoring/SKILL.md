---
name: skill-authoring
description: Catalog skill — frontmatter, caps, rationalization tables, evals. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "writing or revising a sage-mode skill"
---

# skill-authoring

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. Set the frontmatter first: `name` matching the directory, a `description` stating the topic in keywords sage-recall can match on, `disable-model-invocation: true` (required on every skill except `sage-recall` itself), and an `applies_when` phrase naming the concrete situation this skill is retrieved for.
2. Write the required section headings verbatim — `## Procedure`, `## Common Rationalizations`, `## Red Flags`, `## Done when`. The lint checks for that literal heading text; an equivalent section under a different name ("## Pitfalls" instead of "## Red Flags") still fails the required-section rule.
3. Write content that could not be produced by find-and-replace on a sibling in the same category directory. The templated-duplicate check normalizes out only the skill's own `name` and `applies_when` string, then diffs the remaining body against every sibling — if what's left is identical, every copy in the group is flagged, not just whichever was written last.
4. Stay under the line cap for your tier — 250 lines by default, counted against the whole file including frontmatter, with named exceptions (currently `sage-shape` and `design-intake` at 900) for skills that legitimately need more room. Catalog skills are exempt from the line-floor minimum but not from this cap.
5. Don't restate sage-conduct's own vocabulary — the conduct-dupe check flags phrases owned by `rules/sage-conduct.mdc` (its decision-brief format language, specific stock phrases) appearing elsewhere unless that same line also cites `sage-conduct.mdc` directly as a pointer rather than a restatement.
6. Make every procedure step name a real mechanism a practitioner of that discipline would recognize, every rationalization something an engineer would actually say with a technically specific "Reality" (not a restatement of the applies_when phrase), and every red flag observable — this is what the mechanical checks are a proxy for, but only genuinely specific writing satisfies it.
7. Run `lint()` from `lib/lint/index.ts` before calling the skill done; it reports file- and rule-tagged issues — line-cap, line-floor, required-section, disable-model-invocation, conduct-dupe, templated-duplicate — that must all be clear.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll copy a sibling skill and just swap the topic name" | The templated-duplicate check normalizes out exactly the name and applies_when fields before comparing bodies — a name-swapped copy is precisely the pattern it exists to catch, and it fails every file in the group, not only the new one. |
| "It's basically a Red Flags section, the exact heading doesn't matter" | The lint matches the literal string `## Red Flags`; a renamed or reworded heading is invisible to the required-section check no matter what the section actually contains. |
| "It's short, but catalog skills are exempt from the floor anyway" | The floor exemption removes a minimum line count — it does not exempt the file from the templated-duplicate or required-section checks, which apply at any length. |
| "disable-model-invocation doesn't matter, sage-recall finds it anyway" | Without that flag, the model can invoke the skill directly outside sage-recall's ranking — the exact bypass the flag exists to prevent for every skill other than sage-recall. |

## Red Flags

- A body that becomes identical to a sibling's once name and applies_when are stripped out
- A required section present in substance but filed under a different heading than the lint checks for
- A rationalization row whose "Reality" column just restates the applies_when phrase instead of giving a specific technical reason
- A file whose structure and line count suspiciously mirror a sibling's, suggesting it started as a copy rather than the topic's own procedure

## Done when

`lint()` reports zero issues for the file, the body is not template-identical to any sibling once name and applies_when are normalized out, and every procedure step, rationalization, and red flag names something specific to this skill's actual topic.
