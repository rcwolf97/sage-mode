---
name: secrets-scan
description: Catalog skill — keys in git, env files, log redaction. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "checking that credentials are not committed or logged"
---

# secrets-scan

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. Scan the full git history, not just the working tree — `git log -p` or a history-aware tool (gitleaks, trufflehog) — because a secret removed in a later commit is still present in every earlier commit's blob and stays fetchable by anyone with clone access.
2. Run detection by entropy as well as by pattern: a Shannon-entropy check catches ad hoc high-randomness strings (a hardcoded random token) that don't match any known vendor-prefix regex.
3. Check env files specifically: confirm `.env`, `.env.local`, and any `*.env` variant are in `.gitignore` before the first commit that touches them, and check whether `.env.example` accidentally has real values pasted into it instead of placeholders.
4. Grep logging call sites for whole objects passed in (`log.info(user)`, `logger.debug(config)`) — logging an entire object is the most common way a credential field leaks even when nobody typed a secret literally into a log line.
5. Confirm redaction happens at the logging library layer, via a formatter or serializer that masks known-sensitive keys, rather than only at individual call sites — call-site discipline fails the first time someone adds a new call site without knowing the convention.
6. Install a pre-commit hook running the same scanner used in CI, so a leak is caught before it reaches a shared branch — a CI-only check still leaves the secret sitting in pushed history even after the build fails.
7. If a real secret is found already committed, treat rotation as the fix, not deletion: removing it from HEAD, or even rewriting history, does not un-expose it if the repo has ever been cloned, forked, or mirrored.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I deleted it in the next commit, so it's fine now" | Git keeps every blob by default; the secret is still retrievable with `git show <old-sha>:path` by anyone who can clone the repo, indefinitely. |
| "It's just a local .env, it's gitignored now" | If it was committed before the ignore rule existed, the rule only stops future commits — it does nothing to the copy already sitting in history. |
| "It's a test key, it doesn't really matter" | Scanners and reviewers still burn time triaging it, and the pattern normalizes pasting real-looking credentials into tracked files — the next one might not be a dummy. |
| "We redact it in the log statement, that's enough" | One unredacted call site anywhere in the codebase, including third-party middleware logging request bodies, leaks the same field a hundred correctly-redacted call sites protected. |

## Red Flags

- A `.env` file, not `.env.example`, tracked in git now or in history
- Logging calls passing a whole request, user, or config object instead of named safe fields
- A secret rotated only after discovery, with no check of who could have accessed it while exposed
- History scanning skipped because "the current diff looks clean"

## Done when

Full git history (not just the working tree) has been scanned, redaction is enforced at the logging layer, any found secret has been rotated rather than only deleted, and a pre-commit hook mirrors the CI scan.
