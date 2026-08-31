# API-contract checklist

Dispatched whenever the diff touches an API surface (route, handler, schema,
client). The one roster name that also has an identically-named catalog
skill (`skills/catalog/api-contract/SKILL.md`) — load that for the deeper
procedure on writing/versioning a contract; this checklist is the review-time
version, checking a diff against a contract rather than authoring one.

- Is every changed field's type, optionality, and nullability compatible
  with existing callers, or is this a breaking change that isn't versioned
  as one?
- A field removed or renamed instead of deprecated: does anything still
  consuming the old shape break silently instead of erroring?
- New required fields on an existing request/response shape — a genuine
  breaking change for any caller that predates it.
- Error responses: does every documented failure mode actually return the
  documented shape and status code, not a generic 500 or an inconsistent
  error envelope?
- Does the diff's actual behavior match its own schema/OpenAPI/type
  definition, or has one drifted from the other?
- Pagination, rate-limit, and idempotency-key behavior on any modified
  endpoint — unchanged unless the diff says otherwise.
