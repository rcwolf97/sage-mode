---
name: load-test
description: Catalog skill — arrival rates, saturation, SLOs under load. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "proving a service holds a stated request rate"
---

# load-test

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. Write the claim as a number: "N requests/sec sustained for T minutes at P99 < X ms." A load test with no stated target is just traffic.
2. Pick a generator that drives arrival rate, not concurrency. A fixed-thread-pool client (e.g. naive `ab` or a hand-rolled loop) throttles itself on response latency — as the service slows, the client slows with it, and the graph never shows saturation. Use an open-model / closed-loop-free generator (k6 with `arrival-rate` executors, Locust with a custom shape, Gatling's `constantUsersPerSec`) so load keeps arriving even while the service is falling behind.
3. Warm up caches, JIT, and connection pools before the measurement window; report the warm numbers separately from cold-start numbers.
4. Ramp past the target rate until you find the knee — the point where p99 latency stops scaling linearly and starts diverging, or error rate leaves zero. That knee, not the target rate itself, is the actual capacity.
5. Watch the dependency layer during the run: DB connection pool exhaustion, downstream rate limits, thread-pool queue depth. A service that "passes" while its DB pool sits at 100% is one schema migration away from an outage.
6. Re-run the same scenario against the previous known-good build or a lower rate as a control, so a regression shows up as a delta, not a one-off number nobody can compare against.
7. Record generator config, target environment (prod-like sizing, not a laptop), and raw percentile data alongside the pass/fail verdict — not just the headline number.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We hit 500 req/s in staging, ship it" | Staging is usually undersized or overprovisioned relative to prod, and closed-loop tools under-report tail latency near saturation — a number with no knee-point or comparison to prod capacity is not evidence. |
| "Average latency looked fine" | Averages hide the tail that actually pages people. A service can average 40ms with a p99 of 4s if 1% of requests hit a lock or a cold cache path. |
| "We'll just throw more threads at the load generator" | More client threads increases concurrency, not arrival rate — past a point you're measuring your test client's queueing, not the service's. |
| "It passed once, that's enough" | A single run at one point in time doesn't catch time-of-day traffic shape, cache-cold effects, or noisy-neighbor variance; capacity claims need a repeatable, comparable run. |

## Red Flags

- Percentiles reported without the generator's request-per-second setting or duration
- Client-side concurrency capped low enough that it can't produce the claimed rate even in theory
- No visibility into downstream saturation (DB pool, cache hit rate, GC pauses) during the run
- "Passed" with zero errors at exactly the target rate and no attempt to find where it breaks

## Done when

The stated rate was sustained for the stated duration with p99 under the stated bound, the knee-point beyond that rate is known, and the raw run data (config, percentiles, saturation signals) is attached to the result.
