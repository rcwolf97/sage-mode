#!/usr/bin/env python3
"""Golden-fixture comparison helper for hooks/tests/run.sh.

Usage: compare.py <expected.json> <got.json> <actual-exit-status>

Compares the hook's actual stdout (normalized into <got.json> by run.sh)
against the expected fixture, treating a bare "*" anywhere in the expected
value as a wildcard (used by sage-bootstrap's SAGE_HOME / rendered context,
which are environment-dependent). Also asserts the exit status: 2 only when
the expected fixture is a Claude Code deny
(hookSpecificOutput.permissionDecision == "deny" — the documented
Claude Code blocking-error convention, see json-safe.sh's emit_deny), 0 for
every other case on either host (Cursor never uses exit 2 for this; Claude
Code's ask/allow/followup all stay on the exit-0 "parse stdout JSON" path).

Prints "ok" and exits 0 on a match; prints a FAIL line with both sides and
exits 1 otherwise. Empty stdout from the hook is the sentinel `__EMPTY__`
(emitted by run.sh) — that is a crash/no-output, never an allow.
"""
import json
import sys

EMPTY_SENTINEL = "__EMPTY__"


def matches(exp, got):
    if exp == "*":
        return True
    if isinstance(exp, dict):
        return isinstance(got, dict) and set(exp) == set(got) and all(matches(exp[k], got[k]) for k in exp)
    if isinstance(exp, list):
        return isinstance(got, list) and len(exp) == len(got) and all(matches(e, g) for e, g in zip(exp, got))
    return exp == got


def main():
    exp_path, got_path, status_str = sys.argv[1], sys.argv[2], sys.argv[3]
    got_raw = open(got_path).read().strip()
    if got_raw == EMPTY_SENTINEL or not got_raw:
        print("FAIL", exp_path, "— hook produced NO output (parse error or crash?)")
        sys.exit(1)
    exp_raw = open(exp_path).read()
    if not exp_raw.strip():
        exp = {}
    else:
        exp = json.loads(exp_raw)
    got = json.loads(got_raw)
    status = int(status_str)

    want_status = 2 if (isinstance(exp, dict) and exp.get("hookSpecificOutput", {}).get("permissionDecision") == "deny") else 0
    ok = matches(exp, got)

    if status != want_status:
        print("FAIL", exp_path, "(exit code)", "\n expect exit", want_status, "\n got exit   ", status)
        ok = False
    if not ok:
        print("FAIL", exp_path, "\n expect", json.dumps(exp, sort_keys=True), "\n got   ", json.dumps(got, sort_keys=True))
        sys.exit(1)
    print("ok")


if __name__ == "__main__":
    main()
