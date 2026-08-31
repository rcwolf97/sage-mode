---
name: data-backfill
description: Catalog skill — batched backfills, idempotency, resume. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "filling a new column on millions of existing rows"
---

# data-backfill

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. Make new writes correct first: default or dual-write the column going forward so the backfill target is fixed at the current row count instead of a moving one.
2. Write the batch operation to be idempotent — an UPSERT keyed on primary key with a deterministically computed value, or a check-then-write — so running the same chunk twice produces the same row state, not a double-applied change.
3. Batch by primary-key range or a fixed row count per statement, sized to stay well under your statement/transaction timeout, so each chunk commits independently and can be replayed on its own.
4. Persist a durable cursor — a checkpoint row or column, not an in-process variable — so a crash or restart mid-run resumes from the last committed batch instead of row zero.
5. Dry-run the batching logic in read-only mode first: log the row count and estimated batch count, and compare that to the table's known cardinality before any write executes.
6. Throttle between batches against replica lag and lock contention — a fixed sleep or, better, a lag-based backoff — and watch replication lag while the job runs, not after.
7. Verify completion with a query counting rows where the column is still unset, not the job's exit code — a batch that silently skips locked rows can still exit 0.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It's one UPDATE statement, that's simple" | One UPDATE across millions of rows holds a long transaction and heavy locks, blocking concurrent writes, and likely hits a statement timeout partway through — leaving an uncommitted, unresumable partial state. |
| "If it fails I'll just re-run it" | Without idempotency, a retry re-applies increments or side effects to rows the first run already processed, corrupting exactly the rows that succeeded. |
| "The schema change is trivial, skip the dry run" | The schema may be trivial; the data isn't known until you count it — nulls, orphaned foreign keys, and encoding edge cases only show up against real rows. |
| "New rows will get backfilled eventually too" | If new writes aren't already populating the column, the backfill's target keeps growing while it runs and the job never converges to zero remaining rows. |

## Red Flags

- No resumable checkpoint — a restart means starting the range over from the beginning
- Batch size or range picked without checking statement timeout or table size
- No dry-run row count logged before the first write batch executes
- "Done" is defined as job exit code rather than a live count of unfilled rows

## Done when

A query for rows where the target column is still unset returns zero, and re-running the backfill against the same range afterward changes nothing.
