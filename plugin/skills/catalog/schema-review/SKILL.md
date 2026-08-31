---
name: schema-review
description: Catalog skill — relational modeling, constraints, indexes. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "reviewing a proposed schema or ORM model change"
---

# schema-review

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. Read the migration diff against the current schema, not just the model file — a new column with no default on a large table can be a full table rewrite in one engine and a metadata-only change in another; know which your migration tool actually does.
2. Check every foreign key has a supporting index on the referencing column. Most relational databases do not auto-index FK columns; without one, every delete or update on the parent does a sequential scan of the child table to enforce the constraint.
3. Verify uniqueness is enforced with a database-level UNIQUE constraint or index, not only in application code — a "check then insert" race between two concurrent requests produces duplicate rows that only a database-level constraint rejects atomically.
4. Decide nullable vs. NOT NULL deliberately: a nullable column that's "always populated in practice" invites a bug the first time a code path forgets to set it. Enforce it with NOT NULL plus a default, or a CHECK constraint.
5. Weigh a new index's read benefit against its write cost — every index is rewritten on each insert, update, or delete to its columns, and a wide index on a hot write table can visibly slow ingestion even as it speeds the query it was added for.
6. Run EXPLAIN on one query that will actually execute against the new shape — a schema that looks normalized can still force a full scan or an N+1 depending on which columns are indexed and in what order.
7. Check the migration's rollback path: can it run backward without data loss, and does it hold a lock for a bounded, known duration against a production-sized table rather than the empty dev one?

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The ORM enforces that constraint for us" | ORM-level validation only runs through that ORM's code path — a raw SQL script, a background job, or a second service writing to the same table bypasses it entirely, leaving rows the database itself would have refused. |
| "We can add the index later once it's slow" | Adding an index later means building it against a production-sized table, which either locks writes or requires a concurrent build that can run for hours and still fail partway — trivial now, an incident later. |
| "It's just nullable, we'll always set it in practice" | "Always" holds until the next contributor writes an insert path that doesn't know the convention exists; NOT NULL with a default makes the invariant enforced instead of remembered. |
| "Denormalizing here makes the read query fast" | It does, for that one query — and it also creates a second copy of the data that can drift from its source unless something concrete (a trigger, a job, a documented invariant) keeps them in sync. |

## Red Flags

- A foreign key column with no index on it
- A uniqueness requirement described in the PR but enforced only in application code
- A migration adding a column to a large table with no note on lock behavior
- Denormalized or derived data with no stated mechanism keeping it consistent with its source

## Done when

Every foreign key has a supporting index, every uniqueness and required-ness invariant is enforced by a database constraint rather than app code alone, and the migration's lock behavior and rollback path are stated against a production-sized table.
