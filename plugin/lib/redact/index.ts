// redact before sending, not after regretting.
//
// This is a best-effort textual scanner, not a DLP system. It looks for
// known secret *shapes* (AWS/GitHub/Slack/Google/Stripe token prefixes, PEM
// blocks, JWTs), for `key: value` / `key=value` assignment forms whose key
// name is secret-flavored, and for generic high-entropy runs that look like
// a random credential even when nothing else recognizes them. It has no
// notion of what a payload *means* — it cannot tell a real secret from a
// fixture that merely looks like one, and it cannot see a secret that has
// been split across lines, base64-wrapped-inside-base64, or otherwise
// disguised. Treat a clean scan as "nothing *recognizable* was found", never
// as "this payload is safe."
//
// Bias, deliberately: false positives (redacting something that wasn't a
// secret) are cheap — a reviewer loses a little context on one line. False
// negatives (letting a real secret through) are not. Where a rule could go
// either way, this module goes narrower on *shape* (specific token
// prefixes, explicit key-name lists) and wider on the entropy fallback, the
// same "false positives acceptable, false negatives are not" tradeoff
// lib/dag's lane-overlap check and lib/evidence's TOCTOU mtime check already
// make elsewhere in this repo.
//
// Placeholders are STABLE (a pure function of kind + length-class — no
// timestamps, no randomness) and preserve LOCATION: a match is replaced
// in place, on the same line, so a downstream finding can still cite
// `file:line` against the redacted payload. They also preserve a coarse
// LENGTH-CLASS (xs/s/m/l/xl bucket, not the exact character count — an
// exact count would leak information the redaction is trying to remove)
// so a reviewer can tell "a short PIN" from "a 4KB key blob" apart at a
// glance. Placeholder shape: `«REDACTED:<kind>:<length-class>»`.
//
// IDEMPOTENCY: any span that already reads as `«REDACTED:...»` is treated
// as a *protected* region — it is copied through untouched and never
// re-matched by any detector below (including the entropy fallback, which
// would otherwise happily flag the placeholder text's own colons and
// letters). Redacting already-redacted text is therefore a true no-op:
// same text out, and `count` on that second pass is 0, not "however many
// placeholders happened to already exist."

const PLACEHOLDER_RE = /«REDACTED:[^»]*»/g;

function placeholder(kind: string, matchedLength: number): string {
  return `«REDACTED:${kind}:${lengthClass(matchedLength)}»`;
}

function lengthClass(n: number): string {
  if (n <= 8) return "xs";
  if (n <= 16) return "s";
  if (n <= 32) return "m";
  if (n <= 64) return "l";
  return "xl";
}

// Shannon entropy in bits/char over the string's own symbol frequencies.
export function shannonEntropy(s: string): number {
  if (s.length === 0) return 0;
  const freq = new Map<string, number>();
  for (const ch of s) freq.set(ch, (freq.get(ch) || 0) + 1);
  let h = 0;
  for (const count of freq.values()) {
    const p = count / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

export const MIN_ENTROPY_RUN = 32;

// A pure hex alphabet (0-9a-f) has exactly 16 symbols, so Shannon entropy on
// any hex-only string is mathematically capped at log2(16) = 4.0 bits/char —
// not "usually below," *capped*, for every possible hex string of any
// length or content. Requiring entropy STRICTLY greater than 4.0 therefore
// makes it impossible, not just unlikely, for a git SHA or any other
// hex-only value to trip this detector, while base64-ish secrets (a
// 64+-symbol practical alphabet, cap log2(64)=6.0) clear it comfortably in
// practice — empirically ~4.5-5.5 bits/char over 32-40 char samples in this
// module's own tuning trials, vs. ~3.6-3.95 for random hex of the same
// lengths. See test/redact.test.ts for the pinned git-SHA and
// ordinary-sentence cases this threshold is tuned against.
export const ENTROPY_THRESHOLD = 4.0;

export interface RedactResult {
  text: string;
  count: number;
  kinds: Record<string, number>;
}

interface Claim {
  start: number;
  end: number;
  kind: string; // "" for a pre-existing (protected) placeholder span
  protected: boolean;
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

function isClaimed(claims: Claim[], start: number, end: number): boolean {
  return claims.some((c) => overlaps(c, { start, end }));
}

// Secret-flavored key names an assignment's LHS must normalize-equal before
// its value is redacted (lowercased, separators stripped: "API_KEY",
// "api-key", "apiKey" all normalize to "apikey"). Deliberately does not
// include bare "key", "id", or "name" — those false-positive constantly
// ("sort_key", "primary_key") without ever being the secret itself.
const SECRET_KEY_NAMES = new Set([
  "password",
  "passwd",
  "pwd",
  "secret",
  "secretkey",
  "apikey",
  "apisecret",
  "accesskey",
  "accesstoken",
  "authtoken",
  "privatekey",
  "clientsecret",
  "clientid", // paired with clientsecret in most OAuth configs; low false-positive cost
  "token",
  "sessiontoken",
  "refreshtoken",
  "signingkey",
  "encryptionkey",
  "dbpassword",
  "credential",
  "credentials",
  "secretaccesskey",
  "awssecretaccesskey",
  "bearertoken",
]);

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type Detector = (text: string, claims: Claim[]) => Claim[];

// -----------------------------------------------------------------------
// Detectors run in priority order: each one only claims a span that does
// not overlap anything an earlier detector (or a protected placeholder)
// already claimed. Specific, high-confidence shapes go first; the generic
// assignment-form and entropy fallbacks go last, so a Stripe key sitting in
// `"api_key": "sk_live_..."` gets labeled "stripe-key" (from the specific
// detector), not the less useful generic "secret-assignment".
// -----------------------------------------------------------------------

function detectPrivateKey(text: string, claims: Claim[]): Claim[] {
  const re = /-----BEGIN ((?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY)-----[\s\S]*?-----END \1-----/g;
  const out: Claim[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index;
    const end = start + m[0].length;
    if (!isClaimed(claims, start, end) && !isClaimed(out, start, end)) {
      out.push({ start, end, kind: "private-key", protected: false });
    }
  }
  return out;
}

function detectJwt(text: string, claims: Claim[]): Claim[] {
  const re = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{10,}\b/g;
  const out: Claim[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index;
    const end = start + m[0].length;
    if (!isClaimed(claims, start, end) && !isClaimed(out, start, end)) {
      out.push({ start, end, kind: "jwt", protected: false });
    }
  }
  return out;
}

function wholeMatchDetector(re: RegExp, kind: string): Detector {
  return (text, claims) => {
    const out: Claim[] = [];
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    while ((m = r.exec(text))) {
      const start = m.index;
      const end = start + m[0].length;
      if (!isClaimed(claims, start, end) && !isClaimed(out, start, end)) {
        out.push({ start, end, kind, protected: false });
      }
      if (m[0].length === 0) r.lastIndex++; // guard against zero-width matches looping forever
    }
    return out;
  };
}

const detectAwsKey = wholeMatchDetector(/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, "aws-key");
const detectGithubToken = wholeMatchDetector(
  /\b(?:ghp|gho|ghs|ghr|ghu)_[A-Za-z0-9]{36,255}\b|\bgithub_pat_[A-Za-z0-9_]{20,255}\b/g,
  "github-token",
);
const detectSlackToken = wholeMatchDetector(/\bxox[baprs]-[A-Za-z0-9-]{10,72}\b/g, "slack-token");
const detectGoogleApiKey = wholeMatchDetector(/\bAIza[0-9A-Za-z_-]{35}\b/g, "google-api-key");
const detectStripeKey = wholeMatchDetector(/\b(?:sk|rk)_live_[0-9A-Za-z]{20,99}\b/g, "stripe-key");

// Captured-group detectors: claim only the VALUE span, not the whole
// `key: value` match, so the key name stays visible in the redacted text
// for context (`aws_secret_access_key: «REDACTED:aws-secret:l»`).
function valueGroupDetector(re: RegExp, kind: string): Detector {
  return (text, claims) => {
    const out: Claim[] = [];
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    while ((m = r.exec(text))) {
      const value = m[1] ?? m[2] ?? m[3];
      if (!value) {
        if (m[0].length === 0) r.lastIndex++;
        continue;
      }
      const searchFrom = m.index;
      const start = text.indexOf(value, searchFrom);
      if (start < 0) continue;
      const end = start + value.length;
      if (!isClaimed(claims, start, end) && !isClaimed(out, start, end)) {
        out.push({ start, end, kind, protected: false });
      }
      if (m[0].length === 0) r.lastIndex++;
    }
    return out;
  };
}

const detectAwsSecret = valueGroupDetector(
  /\b(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\b\s*[:=]\s*(?:"((?:\\.|[^"\\\n]){20,120})"|'([^'\n]{20,120})'|([^\s,;}\]]{20,120}))/g,
  "aws-secret",
);

const detectBearerToken = valueGroupDetector(/\bBearer\s+([A-Za-z0-9\-._~+/]{20,}=*)/gi, "bearer-token");

// Generic `KEY=value` / `"key": "value"` / `key: value` assignment forms,
// gated on the key name normalizing to something in SECRET_KEY_NAMES.
function detectAssignments(text: string, claims: Claim[]): Claim[] {
  // [ \t]* (not \s*) around the separator — deliberately does NOT cross a
  // newline between "key:" and its value, so a YAML mapping key with a
  // nested block value ("config:\n  api_key: ...") can't swallow the next
  // line's real "api_key: value" pair as if it were `config`'s own value.
  //
  // The unquoted value alternative allows ":" inside the captured value
  // (a deliberate, narrow choice — some legitimate unquoted values contain
  // one, e.g. a URL). That means a candidate whose KEY doesn't qualify can
  // still greedily swallow a *real* "key: value" pair that starts partway
  // through its own value span (`"note: password: realSecret"` — "note"
  // is not secret-flavored, but its greedy unquoted-value capture eats
  // "password:" whole, and re.exec's normal lastIndex advance would then
  // skip straight past the real pair without ever trying it). Escaped
  // double-quoted values ((?:\\.|[^"\\\n])) are handled the same way the
  // JSON-secret case needs.
  const re =
    /(["'`]?)([A-Za-z_][A-Za-z0-9_-]*)\1[ \t]*[:=][ \t]*(?:"((?:\\.|[^"\\\n]){1,300})"|'([^'\n]{1,300})'|([^\s,;}\])]{1,300}))/g;
  const out: Claim[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const key = m[2];
    const value = m[3] ?? m[4] ?? m[5];
    if (!key || !value) continue;
    if (!SECRET_KEY_NAMES.has(normalizeKey(key)) || value.length < 4) {
      // This candidate is being discarded (unqualified key, or "non-trivial"
      // guard). Its greedily-matched value may contain the start of a real
      // "key: value" pair — rewind lastIndex to where the value began so
      // that text gets its own chance to match as an independent candidate,
      // instead of being skipped over by re.exec's normal end-of-match
      // advance. The rewound offset is always > m.index (the value starts
      // after at least the one-character key plus the separator), so this
      // always makes forward progress and cannot loop.
      const valueOffset = m[0].indexOf(value);
      if (valueOffset > 0) re.lastIndex = m.index + valueOffset;
      continue;
    }
    const start = text.indexOf(value, m.index);
    if (start < 0) continue;
    const end = start + value.length;
    if (!isClaimed(claims, start, end) && !isClaimed(out, start, end)) {
      out.push({ start, end, kind: "secret-assignment", protected: false });
    }
  }
  return out;
}

// Fallback: any run of base64/base64url/hex-ish characters, length >= 32,
// whose Shannon entropy clears ENTROPY_THRESHOLD and that no earlier,
// more-specific detector already claimed.
function detectHighEntropy(text: string, claims: Claim[]): Claim[] {
  const re = /[A-Za-z0-9+/=_-]{32,}/g;
  const out: Claim[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index;
    const end = start + m[0].length;
    if (isClaimed(claims, start, end) || isClaimed(out, start, end)) continue;
    if (shannonEntropy(m[0]) > ENTROPY_THRESHOLD) {
      out.push({ start, end, kind: "high-entropy", protected: false });
    }
  }
  return out;
}

const DETECTORS: Detector[] = [
  detectPrivateKey,
  detectJwt,
  detectAwsKey,
  detectAwsSecret,
  detectGithubToken,
  detectSlackToken,
  detectGoogleApiKey,
  detectStripeKey,
  detectBearerToken,
  detectAssignments,
  detectHighEntropy,
];

export function redact(text: string): RedactResult {
  const claims: Claim[] = [];

  // Step 1: protect anything that already looks like our own placeholder —
  // this is what makes redact(redact(x).text) a true no-op.
  let m: RegExpExecArray | null;
  const protectedRe = new RegExp(PLACEHOLDER_RE.source, "g");
  while ((m = protectedRe.exec(text))) {
    claims.push({ start: m.index, end: m.index + m[0].length, kind: "", protected: true });
  }

  // Step 2: run detectors in priority order, each barred from overlapping
  // anything already claimed (protected spans or an earlier detector's find).
  for (const detect of DETECTORS) {
    const found = detect(text, claims);
    claims.push(...found);
  }

  const newClaims = claims.filter((c) => !c.protected).sort((a, b) => a.start - b.start);
  if (newClaims.length === 0) {
    return { text, count: 0, kinds: {} };
  }

  const allSorted = claims.slice().sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  const kinds: Record<string, number> = {};
  for (const c of allSorted) {
    out += text.slice(cursor, c.start);
    if (c.protected) {
      out += text.slice(c.start, c.end); // pass an existing placeholder through verbatim
    } else {
      const matched = text.slice(c.start, c.end);
      // A matched span can itself contain newlines (a PEM private-key block
      // is the one multi-line detector). Collapsing it to a single-line
      // placeholder would shift every subsequent line's number, silently
      // breaking any `path:line` citation a downstream reviewer makes
      // against the redacted payload. Emit the same number of newlines the
      // original span contained so total line count — and every later
      // line's number — is preserved exactly.
      const newlines = (matched.match(/\n/g) || []).length;
      out += placeholder(c.kind, c.end - c.start) + "\n".repeat(newlines);
      kinds[c.kind] = (kinds[c.kind] || 0) + 1;
    }
    cursor = c.end;
  }
  out += text.slice(cursor);

  return { text: out, count: newClaims.length, kinds };
}
