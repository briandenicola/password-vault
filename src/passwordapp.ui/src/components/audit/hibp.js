// HaveIBeenPwned "Pwned Passwords" range check, using k-anonymity so the
// password — and even its full SHA-1 hash — never leaves the client. Only the
// first 5 hex characters of the SHA-1 hash are sent to the range API; the API
// returns every hash suffix sharing that prefix and we match locally.

// SHA-1 of `text`, returned as an uppercase hex string (Web Crypto).
export async function sha1Hex(text) {
  const data = new TextEncoder().encode(String(text));
  const buf = await crypto.subtle.digest('SHA-1', data);
  return [...new Uint8Array(buf)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

// Parse a HIBP range response body ("SUFFIX:COUNT" per line) into a
// Map<suffix, count>. Tolerant of CRLF, padding, and blank lines.
export function parsePwnedRange(body) {
  const map = new Map();
  for (const line of String(body).split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(':');
    if (idx === -1) continue;
    const suffix = trimmed.slice(0, idx).toUpperCase();
    const count = parseInt(trimmed.slice(idx + 1), 10);
    if (suffix) map.set(suffix, Number.isFinite(count) ? count : 0);
  }
  return map;
}

// Number of times `password` appears in known breaches (0 = not found).
// `fetchRange(prefix)` must resolve to the raw range-API body for that prefix;
// it is injected so the network call is testable and so callers control headers.
export async function pwnedCount(password, fetchRange) {
  if (!password) return 0;
  const hash = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const body = await fetchRange(prefix);
  return parsePwnedRange(body).get(suffix) || 0;
}
