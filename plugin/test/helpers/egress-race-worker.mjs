// Worker process for the egress concurrency test in test/egress.test.ts.
// Appends exactly one row to the ledger at the root given as argv[2].
import { record } from "../../lib/egress/index.js";

const root = process.argv[2];
record(root, {
  sink: "anthropic",
  model: "claude-sonnet-5",
  lane: "B",
  bytes: 1,
  content_sha256: "a".repeat(64),
  redactions: 0,
});
