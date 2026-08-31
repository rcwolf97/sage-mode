---
name: api-contract
description: Catalog skill — compatibility, versioning, error shapes, pagination. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "changing a public HTTP or RPC API"
---

# api-contract

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. Classify the change: additive (new optional field, new endpoint) or breaking (removed/renamed field, changed type, changed required-ness, changed status-code meaning, changed pagination cursor format). Breaking changes need a version bump or a parallel path; additive changes don't.
2. Check consumers before you check the schema. Grep or query for actual callers (internal services, SDKs, stored webhooks); "no one should be relying on that field" is a hypothesis, not a fact, until you've looked.
3. Define the error shape before the happy path: what status code, what body shape, and whether it's machine-parseable (a stable `code` string) or just a human message that will get parsed anyway because it's all callers have.
4. Decide pagination semantics explicitly: offset (cheap, breaks under concurrent writes) vs. cursor (stable under writes, opaque token). Document what happens when a cursor points past deleted data.
5. Version the contract, not just the code: a header, a path segment, or a content-type parameter — pick one pattern per API and never mix schemes within it.
6. Write the deprecation window for whatever you're replacing (see the `deprecation` catalog skill) before shipping the replacement, not after.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It's just adding a field, that's always safe" | Only if consumers deserialize leniently. A strict-mode client (many codegen'd SDKs are) can throw on an unrecognized field in a closed schema. Check the consumer's deserialization mode, don't assume. |
| "We control every consumer, we can just tell them" | "Tell them" is not a rollout mechanism. If you can't measure who's still on the old shape, you can't safely remove it. |
| "The error message is clear enough for a human" | Every error message becomes a machine-parsed string within a year, because someone will grep logs for it. Give it a stable code from day one. |
| "Nobody paginates past page 3 anyway" | True until a batch job or a scraper does — at which point an offset-based scheme silently returns duplicate or skipped rows under concurrent writes, and nobody notices until the numbers are wrong. |

## Red Flags

- A "breaking" change shipped under a patch version
- Error responses with three different shapes depending on which code path failed
- Pagination cursor is a raw offset integer with no opacity, now load-bearing for external clients
- No consumer inventory before removing a field

## Done when

The change is classified breaking or additive with evidence, not assumption; the error shape is documented and stable; and if it's breaking, a version boundary or deprecation window exists before the old path is removed.
