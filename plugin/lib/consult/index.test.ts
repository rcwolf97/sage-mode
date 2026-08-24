import assert from "node:assert/strict";
import test from "node:test";
import { warnIfApiKeyInherited } from "./index.js";

// Minor fix: lib/consult bridges to `claude -p` for Lane B (flat-rate subscription
// billing). An inherited ANTHROPIC_API_KEY can silently reroute that call to metered
// API billing. These tests exercise the warning in isolation (never invoking the real
// `claude` CLI, which is unsafe/costly/nondeterministic to shell out to from a test).

function captureStderr(fn: () => void): string {
  const original = process.stderr.write.bind(process.stderr);
  let out = "";
  process.stderr.write = ((chunk: unknown) => {
    out += String(chunk);
    return true;
  }) as typeof process.stderr.write;
  try {
    fn();
  } finally {
    process.stderr.write = original;
  }
  return out;
}

test("warnIfApiKeyInherited writes a loud stderr warning when ANTHROPIC_API_KEY is set", () => {
  const prior = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "sk-ant-test-fixture";
  try {
    const out = captureStderr(() => warnIfApiKeyInherited());
    assert.match(out, /ANTHROPIC_API_KEY/);
    assert.match(out, /metered/i);
    assert.match(out, /subscription/i);
    assert.match(out, /unset/i);
  } finally {
    if (prior === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = prior;
  }
});

test("warnIfApiKeyInherited stays silent when ANTHROPIC_API_KEY is not set", () => {
  const prior = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const out = captureStderr(() => warnIfApiKeyInherited());
    assert.equal(out, "");
  } finally {
    if (prior !== undefined) process.env.ANTHROPIC_API_KEY = prior;
  }
});
