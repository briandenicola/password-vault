# ADR-0005: Server-side Entra token validation (flag-gated)

- **Status:** Accepted
- **Date:** 2026-06-24

## Context

The API previously relied on TLS plus a Functions host key for protection; the
SPA signed in with Entra (Azure AD) but the **API did not validate the token**.
Access is already restricted at the Enterprise App to a "parents" group, so an
allowlist is optional, but the API should still verify the caller's token.
Flipping this on incorrectly could lock the family out, so rollout must be safe.

## Decision

Add **server-side Entra ID token validation** as a pure validator
(`Common/EntraTokenAuth.cs`) plus isolated-worker middleware
(`Common/JwtAuthenticationMiddleware.cs`). It validates issuer/audience/
signature/lifetime via `JsonWebTokenHandler`, extracts the `oid` claim, and
supports an **optional** object-id allowlist (empty = rely on the Enterprise App
group). Audience = the API App ID URI.

Gate it behind **`AUTH_ENABLED` (default OFF)**. The browser function key stays
until cutover. Cutover is a documented runbook ([`docs/entra.md`](../entra.md)):
enable + verify → flip triggers to Anonymous and drop the browser key → rotate
the leaked key.

## Consequences

- The validation code path ships and is unit-tested (23 tests) without changing
  production behavior until the flag is flipped.
- Safe, staged rollout with a clear backout (turn the flag off).
- **Open items (AC-2):** triggers are still keyed; the previously committed
  function key and App Insights string in git history must be rotated at cutover.
