---
name: deploy-setup
description: Catalog skill — environments, rollouts, health checks, config. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "standing up a new deploy path or environment"
---

# deploy-setup

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. Choose the rollout strategy deliberately — blue-green (instant cutover, needs double capacity), rolling (gradual instance replacement, brief mixed-version window), or canary (small traffic slice, automated metric comparison) — based on blast-radius tolerance for this service, not on habit.
2. Define a readiness probe the orchestrator actually gates on: one that checks downstream dependencies the service needs (DB connection, cache, required config loaded), not just "the process is listening on the port."
3. Externalize environment-specific values — endpoints, feature flags, secrets — into environment config or a secret store rather than baking them into the build artifact, so the exact same binary promotes unchanged across environments.
4. Define the automatic rollback trigger before the first real rollout: a specific metric (error rate, latency p99, consecutive health-check failures) and threshold that reverts automatically, not a judgment call made by a paged human mid-incident.
5. Exercise the rollback path in this environment before you need it — a rollback script that has never actually run is an assumption, not a safety net.
6. Smoke-test the environment's network and access boundaries directly (security groups, IAM roles, DNS resolution, TLS certs) rather than trusting a "deploy succeeded" signal from the orchestrator alone.
7. Stage the traffic ramp for the first real rollout — for example 1% then 10% then 50% then 100% — with a soak period at each step, instead of cutting over 0-to-100 on the first production deploy.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It deployed successfully, we're done" | "Deploy succeeded" usually just means the process started — it says nothing about whether the readiness probe is real or whether the service is correctly serving traffic. |
| "We'll figure out rollback if something breaks" | Building a rollback path for the first time during a live incident, under pressure, is how a five-minute blip turns into a multi-hour outage. |
| "Config in the build artifact is simpler to reason about" | Baking environment-specific config into the artifact means each environment runs a different, untested binary — the whole point of promoting one tested build is lost. |
| "The canary slice is too small to trust its metrics" | That argues for a longer soak or a larger canary percentage, not for skipping canary entirely — skipping it just moves the discovery of a bad build to 100% of production traffic. |

## Red Flags

- Health check only confirms the port is open, with no dependency checks behind it
- No rollback procedure has been executed even once in this specific environment
- Environment secrets or config values are hardcoded into the build artifact
- First rollout to a new environment goes straight to 100% of traffic with no staged ramp

## Done when

The readiness probe checks real downstream dependencies, the rollback path has been exercised at least once in this environment, and config is externalized so the artifact under test is the artifact being promoted.
