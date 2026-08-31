# Security checklist

Dispatched on any auth-touching diff, or a backend diff over 100 lines.
`NEVER_GATE` — never scoped out by the self-tuning roster regardless of
historical hit rate; a specialist that has found nothing in ten dispatches
is still insurance, not waste, for this category specifically.

- Every new or modified authorization check: does it run before the
  privileged action, on every code path that reaches it — not just the
  common one?
- User-controlled input reaching a shell command, SQL string, file path, or
  template without going through the existing sanitization/parameterization
  the rest of the codebase uses.
- Secrets: any literal credential, token, or key in the diff, even in a
  test fixture or a comment.
- A new endpoint or capability that's reachable without the authentication
  the rest of the API requires — check the route registration, not just the
  handler body.
- Session/token handling: is anything long-lived stored somewhere a
  different user's request could read it (a shared cache keyed wrong, a
  module-level variable)?
- Does an error message leak internal state (a stack trace, a raw DB error,
  an internal path) to an untrusted caller?
