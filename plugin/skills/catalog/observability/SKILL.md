---
name: observability
description: Catalog skill — instrumentation, metrics, tracing, logs, SLOs. Retrieved by sage-recall, never auto-loaded.
disable-model-invocation: true
applies_when: "adding production telemetry to a service"
---

# observability

Load this file only when sage-recall ranked it for the current work.

## Procedure

1. Instrument by the RED method for request-driven paths (Rate, Errors, Duration per endpoint/operation) and by USE for the resources underneath (Utilization, Saturation, Errors per CPU/queue/pool/disk). Don't stop at "add some metrics" — name which of these six you're covering and which you're deliberately skipping.
2. Choose metric type deliberately: counters for things that only increase (requests, errors), gauges for point-in-time levels (queue depth, pool size), histograms for distributions you'll need percentiles from (latency). A latency tracked as a gauge of "last request time" can't produce a p99 later — the data to compute it was never kept.
3. Before adding a label to a metric, ask what its cardinality is. `user_id`, raw URL path with IDs embedded, or a UUID as a label value each turn one metric into millions of time series and can take down the metrics backend itself. Bucket or template high-cardinality dimensions (`/users/{id}` not `/users/1234`) or move them to logs/traces instead.
4. Set trace sampling deliberately, not at 100% by default in a high-QPS path: head-based sampling at a fixed rate is cheap but can drop the rare slow/error trace you actually need; tail-based sampling (keep traces that errored or were slow, drop the rest) costs more infra but preserves the interesting ones.
5. Make logs structured (key-value or JSON) and include the trace ID on every log line in the request path, so a person can jump from "this trace was slow" to "these exact log lines" without grepping timestamps.
6. Define the SLO as a ratio over a rolling window (e.g. 99.9% of requests < 300ms over 28 days) tied to an error budget, not a static threshold alert that pages on every blip.
7. Alert on symptoms visible to users (SLO burn rate, error rate) as pages; alert on causes (disk filling, queue growing) as tickets or dashboards, not both at the same severity.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "More labels means better filtering later" | Every new label multiplies the time-series count by its cardinality — a `request_id` or raw user-agent label on a busy endpoint can silently 10x your metrics bill or crash the TSDB's index. |
| "We'll trace everything, storage is cheap" | Trace storage is cheap; the collector CPU and network overhead of 100% head-sampling on a hot path usually isn't, and it buries the interesting traces in noise anyway. |
| "Logs are enough, we don't need metrics" | Logs answer "what happened in this one request"; metrics answer "how is the system trending" cheaply at scale — grepping logs to reconstruct a rate-over-time is slow and often wrong once volume is high. |
| "We added a dashboard, we're observable now" | A dashboard nobody gets paged from when it crosses a bad threshold is a wall decoration — observability means someone finds out before a customer does. |

## Red Flags

- A metric labeled with anything unbounded: user ID, session ID, raw path with path params, IP address
- Latency captured only as an average or a gauge, with no histogram/percentile capability
- 100% trace sampling on a high-traffic path with no tail-based fallback
- Alerts defined on internal causes (CPU%, queue depth) at page-worthy severity instead of on user-facing symptom SLOs

## Done when

RED/USE coverage is explicit for the service's request paths and resources, every metric's cardinality is bounded and justified, traces carry IDs correlated to logs, and at least one SLO-backed alert exists that would have caught the last real incident in this area.
