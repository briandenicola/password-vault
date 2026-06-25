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

Gate it behind **`AUTH_ENABLED`**, but make the production default fail-closed:
auth is enabled unless `AUTH_ENABLED=false` is explicitly set for local/offline
development. The cutover runbook ([`docs/entra.md`](../entra.md)) configures
tenant/audience settings before deployment, removes the browser function key,
and rotates the leaked key.

## Consequences

- The validation code path is unit-tested and fails closed: protected endpoints
  return 401 if Entra settings are missing or invalid.
- A local/offline backout remains available by explicitly setting
  `AUTH_ENABLED=false`.
- HTTP triggers are anonymous and guarded by middleware; the browser no longer
  receives a function key.
