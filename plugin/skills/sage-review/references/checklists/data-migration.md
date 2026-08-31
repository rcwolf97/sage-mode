# Data-migration checklist

Dispatched whenever the diff touches a migration/schema file. `NEVER_GATE` —
never scoped out by the self-tuning roster, the same as `security`; a bad
migration is one of the few finding categories where "hasn't found anything
in ten dispatches" says nothing about the eleventh.

Cross-check directly against `implementer-data.md`'s migration-safety
checklist — this specialist is verifying that checklist was actually
followed, not re-deriving it from scratch:

- Backward-compatible with the currently-deployed code, or a genuine
  expand/contract plan staged across two nodes — not "we'll deploy them
  together."
- Any backfill: batched, resumable, with an explicit row-count or time cap —
  not "it's a small table today."
- Reversible, or a written rollback alternative with the reason it can't be
  reversed — "restore from backup" is not a per-migration rollback plan.
- Locking/index changes checked against realistic table size — a note on
  blocking DDL against a hot table, not a size assumption.
- Does the migration and the code that depends on its post-migration shape
  ship in a sequence that's safe if the migration runs first, or if the code
  deploys first (they usually don't happen atomically)?
- Data correctness of the migration itself: does it handle NULLs, duplicate
  keys, and rows already in an edge-case state the migration's author didn't
  consider?
