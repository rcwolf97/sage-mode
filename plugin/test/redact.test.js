import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { redact, shannonEntropy, ENTROPY_THRESHOLD } from "../lib/redact/index.js";
test("aws access key id is redacted", () => {
    const r = redact("AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE end");
    assert.ok(r.text.includes("«REDACTED:aws-key"));
    assert.ok(!r.text.includes("AKIAIOSFODNN7EXAMPLE"));
    assert.equal(r.kinds["aws-key"], 1);
});
test("aws secret access key (context-gated) is redacted, key name left visible", () => {
    const r = redact('aws_secret_access_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"');
    assert.ok(r.text.includes("aws_secret_access_key"));
    assert.ok(r.text.includes("«REDACTED:aws-secret"));
    assert.ok(!r.text.includes("wJalrXUtnFEMI"));
});
test("github tokens (ghp_/gho_/ghs_/github_pat_) are redacted", () => {
    const fixtures = [
        "ghp_" + "a".repeat(36),
        "gho_" + "B".repeat(36),
        "ghs_" + "c1".repeat(20),
        "github_pat_" + "d".repeat(30),
    ];
    for (const secret of fixtures) {
        const r = redact(`token: ${secret}`);
        assert.ok(r.text.includes("«REDACTED:github-token"), secret);
        assert.ok(!r.text.includes(secret), secret);
    }
});
test("slack tokens (xox[baprs]-...) are redacted", () => {
    const r = redact("SLACK_TOKEN=xoxb-1234567890-abcdefghijklmnop");
    assert.ok(r.text.includes("«REDACTED:slack-token"));
    assert.ok(!r.text.includes("xoxb-1234567890"));
});
test("google api keys (AIza...) are redacted", () => {
    const r = redact("key = AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY");
    assert.ok(r.text.includes("«REDACTED:google-api-key"));
    assert.ok(!r.text.includes("AIzaSyD-9tSrke72PouQMnMX"));
});
test("stripe live keys (sk_live_/rk_live_) are redacted", () => {
    const r = redact("STRIPE_KEY=sk_live_51H8x9K2eZvKYlo2CGvVvBORw0000000000");
    assert.ok(r.text.includes("«REDACTED:stripe-key"));
    assert.ok(!r.text.includes("sk_live_51H8x9K2eZvKYlo2CGvVvBORw"));
});
test("private key PEM blocks are redacted as one span", () => {
    const pem = [
        "-----BEGIN RSA PRIVATE KEY-----",
        "MIIEowIBAAKCAQEAxq8example000000000000000000000000000000000000",
        "restofthekeymaterialthatspansmultiplelinesinarealprivatekeyfile",
        "-----END RSA PRIVATE KEY-----",
    ].join("\n");
    const r = redact(`before\n${pem}\nafter`);
    assert.ok(r.text.includes("«REDACTED:private-key"));
    assert.ok(!r.text.includes("MIIEowIBAAKCAQEAxq8example"));
    assert.ok(r.text.includes("before"));
    assert.ok(r.text.includes("after"));
});
test("JWTs are redacted", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
        "." +
        "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0" +
        "." +
        "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const r = redact(`Authorization: ${jwt}`);
    assert.ok(r.text.includes("«REDACTED:jwt"));
    assert.ok(!r.text.includes("SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"));
});
test("generic bearer tokens are redacted, the word Bearer stays", () => {
    const r = redact("Authorization: Bearer abcdEFGH12345678ijklMNOPqrst9999");
    assert.ok(r.text.startsWith("Authorization: Bearer «REDACTED:bearer-token"));
});
test("KEY=value assignment form with a secret-flavored key is redacted", () => {
    const r = redact("DB_PASSWORD=hunter2superSecretValue123");
    assert.ok(r.text.includes("DB_PASSWORD="));
    assert.ok(r.text.includes("«REDACTED:secret-assignment"));
    assert.ok(!r.text.includes("hunter2superSecretValue123"));
});
test('"password": "value" JSON assignment form is redacted', () => {
    const r = redact('{"username": "alice", "password": "correcthorsebatterystaple"}');
    assert.ok(r.text.includes('"username": "alice"'));
    assert.ok(r.text.includes("«REDACTED:secret-assignment"));
    assert.ok(!r.text.includes("correcthorsebatterystaple"));
});
test("api_key: value YAML-style assignment form is redacted", () => {
    const r = redact("config:\n  api_key: sup3rDup3rLongApiKeyValueHere\n  timeout: 30");
    assert.ok(r.text.includes("«REDACTED:secret-assignment"));
    assert.ok(r.text.includes("timeout: 30"));
    assert.ok(!r.text.includes("sup3rDup3rLongApiKeyValueHere"));
});
test("a non-secret-named key is left completely alone, even with a long-ish value", () => {
    const r = redact('{"role": "admin", "sort_key": "created_at_descending"}');
    assert.equal(r.count, 0);
    assert.equal(r.text, '{"role": "admin", "sort_key": "created_at_descending"}');
});
test("a trivial value under a secret-named key is NOT redacted (non-trivial guard)", () => {
    const r = redact("password: ab");
    assert.equal(r.count, 0);
});
// --- The two directions the entropy threshold is pinned against ---
test("a 40-char git SHA is NOT redacted", () => {
    const sha = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4";
    assert.equal(sha.length, 40);
    const r = redact(`fixes applied in commit ${sha} on main`);
    assert.equal(r.count, 0);
    assert.ok(r.text.includes(sha));
});
test("several more random 40-char hex strings (simulated git SHAs) are NOT redacted", () => {
    for (let i = 0; i < 25; i++) {
        const sha = createHash("sha1").update(`commit-${i}`).digest("hex");
        const r = redact(`see ${sha} for details`);
        assert.equal(r.count, 0, sha);
    }
});
test("an ordinary sentence is NOT redacted", () => {
    const text = "The quarterly report shows steady growth across every region, and the team " +
        "plans to revisit the roadmap once the current sprint closes out next week.";
    const r = redact(text);
    assert.equal(r.count, 0);
    assert.equal(r.text, text);
});
test("a long high-entropy base64-ish run with no other matching shape is redacted by the entropy fallback", () => {
    // A synthetic random-looking base64 run, not matching any specific prefix pattern.
    const blob = "kQ8pXz2LmN9vRt5WbY7cFj3HsD1uEo6AqI4gT0nZ";
    assert.ok(shannonEntropy(blob) > ENTROPY_THRESHOLD, `fixture entropy too low: ${shannonEntropy(blob)}`);
    const r = redact(`opaque_blob = ${blob}`);
    assert.ok(r.text.includes("«REDACTED:high-entropy"));
    assert.ok(!r.text.includes(blob));
});
test("a long, low-entropy repeated-character run is NOT redacted", () => {
    const r = redact("padding: " + "x".repeat(50));
    assert.equal(r.count, 0);
});
// --- idempotency ---
test("redacting already-redacted text is a true no-op: same text, zero new redactions", () => {
    const first = redact("AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE and password: correcthorsebatterystaple");
    assert.ok(first.count >= 2);
    const second = redact(first.text);
    assert.equal(second.text, first.text);
    assert.equal(second.count, 0);
    assert.deepEqual(second.kinds, {});
});
test("count and kinds accurately tally a mixed payload", () => {
    const r = redact(["AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE", "GITHUB_TOKEN=" + "ghp_" + "a".repeat(36), 'password: "hunter2superSecret"'].join("\n"));
    assert.equal(r.count, 3);
    assert.equal(r.kinds["aws-key"], 1);
    assert.equal(r.kinds["github-token"], 1);
    assert.equal(r.kinds["secret-assignment"], 1);
});
