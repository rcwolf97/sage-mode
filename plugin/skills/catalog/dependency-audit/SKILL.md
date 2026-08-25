---
name: dependency-audit
description: Catalog skill — pinning, CVEs, supply chain, lockfiles. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "adding or upgrading a third-party dependency"
---

# dependency-audit

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. Inspect the full resolved tree, not just the top-level version: diff the lockfile before and after to see every transitive package that changed, not only the one you asked to add or bump.
2. Run an SCA/vulnerability scan (npm audit, pip-audit, osv-scanner, or equivalent) against the exact resolved versions in the lockfile — a scan against the manifest's version range can miss what actually gets installed.
3. Pin to an exact version rather than a caret or tilde range for anything that isn't a well-audited, high-scrutiny library, and commit the lockfile so CI resolves the identical tree every run.
4. Check maintenance signal: last publish date, open CVE count, single-maintainer risk, and whether a recent version shows a sudden, unexplained jump in package size or an ownership transfer — a common precursor to a supply-chain compromise.
5. Confirm the declared license is compatible with how this project is distributed before merging, not after legal flags it post-release.
6. Read (or explicitly disable) any install-time lifecycle script — a postinstall hook runs with your CI's full permissions and can exfiltrate secrets or plant a backdoor before your code ever executes.
7. Record the decision — version chosen, scan result, any accepted risk — somewhere durable, so the next upgrade of this package doesn't repeat the investigation from scratch.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It's popular, millions of downloads, it's fine" | Popularity is not a security property — several widely-used packages have shipped compromised versions via hijacked maintainer accounts, download count included. |
| "The semver range keeps us patched automatically" | A caret range lets a broken or compromised patch install silently on the next CI run, with no PR and no review before it reaches production. |
| "The CVE is in a transitive dep we never call directly" | "Never call directly" is usually untested — the vulnerable code path may still be reachable through how the direct dependency itself uses that transitive package. |
| "We'll audit it properly after we ship" | Once merged, the dependency is in the lockfile and gets pulled into every future install; auditing after the fact means finding the problem on a much larger, harder-to-revert surface. |

## Red Flags

- Lockfile diff touches dozens of unrelated transitive packages for one direct-dependency bump
- New dependency ships a postinstall script that no one has read
- Manifest uses a `^`, `~`, or `latest` range for a package with install-time code execution
- PR has no scanner output attached, just "checked, looks fine"

## Done when

The lockfile is committed with exact resolved versions, an SCA scan against those resolved versions shows zero unaddressed high/critical findings (or the accepted risk is documented), and the decision is recorded next to the change.
