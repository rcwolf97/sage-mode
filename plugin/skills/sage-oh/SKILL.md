---
name: sage-oh
description: One question, two postures. Verdict to build, build-smaller, don't-build, or needs-evidence.
disable-model-invocation: true
---

# sage-oh

Deliberately small. One question, two postures (ship vs play). Interrogation patterns live in `skills/sage-shape/references/` — load them, do not copy them.

**Reads:** the question, notebook, `sage recall --kind out-of-scope`. **Writes:** `<notebook>/ideas/<slug>.md`; on `don't-build` or `needs-evidence`, also `.sage/out-of-scope/<slug>.md`.

## Procedure

1. Ask which posture this is: **ship** (someone will use it) or **play** (you want to see it). One question. Stop until answered.
2. Recall: `sage recall "<concept>" --kind out-of-scope` then `--kind learning`. A prior reject is the answer unless the user explicitly reopens it.
3. Premise challenge via `sage consult --role product --brief <file>`. The consult's `model_receipt.verified` must be copied onto the idea as `verified: true|false`. Never implied. Web research goes through `lib/redact` + `lib/egress` (category terms only).
4. Write `<notebook>/ideas/<slug>.md` with verdict **exactly one of** `build | build-smaller | don't-build | needs-evidence` and a one-line Assignment.
5. Handoffs: `build` / `build-smaller` → tell the user `/sage-shape` is next. `don't-build` / `needs-evidence` → write `.sage/out-of-scope/<slug>.md` with frontmatter `kind: out-of-scope`, `concept: <slug>`, `rejected: <date>`.
6. Advisory: `sage review doc <notebook>/ideas/<slug>.md` before treating the verdict as settled. Non-blocking. Unavailable reviewer → one-line notice.

## Non-interactive

If posture is unstated, record `needs-evidence` and write out-of-scope. Terminal: `Oh: <verdict> → <path>`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "They obviously want to build it" | Unstated posture is `needs-evidence`, not `build`. |
| "Verified because I asked for the role" | `extractModelReceipt` said `verified: false` or the field is missing. Copy that. |

## Red Flags

- A `build` verdict with no `verified:` field
- A `don't-build` that never wrote out-of-scope (shape will re-propose it)

## Done when

- The idea file exists with a legal verdict, and rejects are in `.sage/out-of-scope/`.
