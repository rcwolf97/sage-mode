---
name: migration-safety
description: Catalog skill — expand-contract migrations, locks, backfills. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "changing a database schema on a live large table"
---

# migration-safety

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. Split the change into expand and contract phases. Expand: add the new column/table/index as nullable or with a default, deploy code that writes to both old and new shape. Contract: once all writers and readers are migrated, drop the old column in a separate release. Never rename or narrow a column in one step on a live table.
2. Check what lock the DDL actually takes, not what you assume. `ADD COLUMN ... DEFAULT` on Postgres ≥11 is metadata-only and fast; the same on MySQL before 8.0 instant DDL rewrites the whole table under a metadata lock. `ALTER ... NOT NULL` typically requires a full table scan to validate. Know your engine's specific behavior before running it against a table with real traffic.
3. For anything that isn't metadata-only, use an online schema-change tool (`gh-ost`, `pt-online-schema-change`, Postgres's `CREATE INDEX CONCURRENTLY`) that copies via triggers/shadow table instead of holding a blocking lock for the duration.
4. Backfill existing rows in small batches with a throttle (sleep between batches, or a rate cap) and re-check replication lag between batches — a single giant `UPDATE` on a large table can blow up the WAL/binlog and lag replicas for minutes.
5. Add the constraint (NOT NULL, foreign key, uniqueness) as `NOT VALID` / unchecked first, backfill, then validate it in a separate step that doesn't hold a long lock while scanning.
6. Write the down-migration and actually test it against a snapshot before merging — a migration you can't reverse turns a bad deploy into a multi-hour incident.
7. Confirm the ORM's cached schema/prepared statements won't choke on the transitional state (old and new columns coexisting) during the rollout window.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It's just one column, it'll be fast" | "Just one column" with a NOT NULL constraint or non-null default on pre-11 Postgres/pre-8.0 MySQL rewrites every row and holds a lock for the duration — table size, not column count, determines lock time. |
| "We'll run it in a maintenance window" | Maintenance windows hide the problem, they don't fix it — the same blocking DDL against a table that's grown 3x by the next deploy will overrun the window and the on-call finds out live. |
| "Rename is basically the same operation as add+drop" | A rename breaks every in-flight query and cached prepared statement still referencing the old name the instant it commits — there's no rollout window, it's atomic breakage. |
| "The backfill is idempotent so we can just run it in one shot" | Idempotent means safe to re-run, not safe to run unbounded — one unbatched UPDATE across millions of rows still holds row locks and floods replication in a single transaction. |

## Red Flags

- A migration that adds a NOT NULL column or constraint in the same step it's created, with no backfill phase
- DDL against a table over a few million rows with no online-schema-change tool and no lock-duration estimate
- A backfill script with no batch size, no throttle, and no way to resume from where it stopped
- No tested rollback path, or a rollback that itself requires another blocking schema change

## Done when

The change is split into expand/contract steps each independently deployable, the lock behavior of every DDL statement is known for the actual engine version in use, the backfill is batched and resumable, and a tested rollback exists for each step.
