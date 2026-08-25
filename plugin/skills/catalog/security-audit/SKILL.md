---
name: security-audit
description: Catalog skill — authn, authz, injection, secrets, threat surfaces. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "auditing auth, sessions, or trust boundaries"
---

# security-audit

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. Map every entry point that accepts external input — HTTP routes, queue consumers, webhooks, CLI flags fed from untrusted sources — before checking any single one; an audit that starts at the first route found is a spot check, not an audit.
2. For each entry point, check authentication and authorization as two separate questions: first confirm who the caller is proven to be (a verified token or session), then separately confirm what that identity is allowed to do here. A route can correctly reject anonymous callers and still let any authenticated user reach another user's resource.
3. Look specifically for IDOR: does the handler re-derive ownership from the authenticated session (`resource.owner_id == current_user.id`), or does it trust an ID taken straight from the request path or body?
4. Check the injection classes relevant to what the code actually does — SQL (string-built queries vs. parameterized), command injection (shell calls built from input), SSRF (server-side requests to a URL derived from user input), unsafe deserialization — not a generic pass with no named class.
5. Trace where secrets live at runtime: environment variable vs. secrets manager, which processes can read them, and whether they're ever echoed into logs, error messages, or client-visible responses such as a stack trace containing a connection string.
6. Verify session handling: expiry is enforced server-side rather than only by a client-side timer, tokens are invalidated on logout or password change, and session identifiers are regenerated on privilege change to prevent fixation.
7. Write each finding as exploitable-or-not with a concrete request or payload that demonstrates it — a theoretical concern with no reproduction step is flagged as lower priority, not silently dropped from the report.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It's behind a login, so it's already safe" | Authentication proves identity, not permission — a logged-in user hitting another tenant's `/orders/{id}` with a guessed ID is still unauthorized access if ownership isn't re-checked server-side. |
| "The frontend already hides or validates this" | Client-side checks are a UX convenience an attacker skips by calling the API directly; an authorization decision made only in the frontend is not enforced at all. |
| "We use an ORM, so SQL injection isn't a concern" | An ORM protects the query paths that go through it; a raw query, a dynamic `ORDER BY` built from input, or a second data layer bypassing the ORM reintroduces the same bug class. |
| "It's an internal endpoint, it doesn't need auth checks" | "Internal" describes network position, not who can reach it — a compromised adjacent service, an SSRF from another endpoint, or a future proxy placed in front of it all turn "internal" into attacker-reachable. |

## Red Flags

- Authorization checks that trust an ID from the request instead of re-deriving it from the authenticated session
- Error responses or logs that include stack traces, connection strings, or full request/user objects
- Session tokens with no server-side expiry or no invalidation on logout
- A finding written as "seems risky" with no request that demonstrates it

## Done when

Every external entry point has a documented authn and authz check verified against the code, the injection classes relevant to this system were checked with a real payload, and every confirmed finding has a reproduction step and a severity.
