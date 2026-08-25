---
name: error-taxonomy
description: Catalog skill — exception classes, user-visible errors, retries. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "defining what fails, who sees it, and whether it is retried"
---

# error-taxonomy

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. Define a small fixed hierarchy up front — e.g. ValidationError, NotFoundError, ConflictError, UpstreamTimeoutError, InternalError — and require every raised error to be one of them, not a bare Exception with a string message.
2. Decide retryability as a property of the class, not the call site: timeouts and 5xx-from-upstream are retryable, validation and permission errors are not. Encode it as a field on the class so callers don't guess per instance.
3. Decide user-facing visibility per class: which get a safe, actionable message shown to the end user, which collapse to a generic message plus an internal error id, and which never reach the user at all.
4. Map each class to an HTTP status or RPC code exactly once, centrally, so the same mapping isn't reimplemented inconsistently across handlers.
5. Attach a stable machine-readable error code to each class, separate from the human-readable message, so clients can branch on it even after the wording changes.
6. Audit for stringly-typed errors: grep for bare `raise Exception(`, catch blocks that discard the exception type, or error messages that calling code parses — each is a taxonomy leak.
7. Wire retryable classes into the actual retry/backoff logic and confirm non-retryable classes are excluded there too, not just documented as non-retryable in a comment.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We'll just catch Exception and log it, we're moving fast" | An undifferentiated catch treats a user typo and a database outage identically — retries get applied to permanent failures and withheld from transient ones. |
| "The error message is descriptive enough, we don't need a code" | Message copy gets reworded constantly; any caller or dashboard matching on message text breaks silently the next time someone improves the wording. |
| "Retryability is obvious from context, we don't need to encode it" | Obvious to the engineer at the call site that week. Not obvious to the retry middleware three services away, or to whoever copies the pattern without the context. |
| "Internal and user-facing errors can share a class, we'll branch at render time" | That pushes a security-relevant decision — does this leak a stack trace or a SQL fragment — into every render site instead of fixing it once on the error type. |

## Red Flags

- Bare `except Exception` or equivalent catch-all with no re-classification before handling
- A retry loop that fires on any non-2xx response regardless of error type
- User-facing error text containing internal identifiers, stack frames, or raw exception strings
- Error codes that change whenever someone edits the message copy

## Done when

Every raised error belongs to a documented class with retryability and user-visibility fixed at the class level, and both the retry logic and the error-rendering code branch on that classification rather than on message strings.
