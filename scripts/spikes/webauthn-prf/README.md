# WebAuthn PRF Spike

Throwaway validation for the zero-knowledge encryption design
([`docs/design/e2ee.md`](../../../docs/design/e2ee.md), backlog `OFF-4`).

**Goal:** confirm on *each real family device* that a passkey can derive an encryption
key via the WebAuthn **PRF extension**, and that the full envelope flow works:

```
passkey PRF  →  HKDF  →  KEK (AES-KW)  →  unwrap random DEK  →  AES-GCM decrypt
```

This is the riskiest assumption in the plan (PRF support varies — Windows Hello needs
Win11 25H2+; Entra-issued-passkey PRF is still maturing). Validate before building.

> ⚠️ Self-contained, no dependencies, **no server, no real secrets**. Stores a wrapped
> *test* key in `localStorage` only. Delete the folder when done.

## Run it

WebAuthn requires a **secure context** (HTTPS *or* `localhost`).

### On a laptop/desktop (easiest)
```bash
cd scripts/spikes/webauthn-prf
python3 -m http.server 8000
# open http://localhost:8000  (localhost counts as secure)
```
Click **Enroll passkey → Set up & encrypt sample → Lock & unlock**. Look for the green
**PASS ✅** verdict, and note the "PRF extension enabled" line.

### On a phone / to test synced passkeys (needs HTTPS)
`localhost` won't reach the page from a phone, so expose it over HTTPS one of:
- a tunnel (e.g. `cloudflared tunnel --url http://localhost:8000` or `ngrok http 8000`), or
- drop the folder on the deployed Static Web App and browse to it.

Then run the same three steps on the phone.

## What a PASS means
- This device's passkey returns a deterministic PRF secret for our salt.
- A random DEK can be wrapped/unwrapped by the PRF-derived KEK across separate assertions.
- AES-GCM round-trips the sample (incl. non-ASCII) — i.e. the design is viable here.

## What to record per device
| Device / OS / Browser | Passkey type (platform/synced/security key) | PRF enabled | Verdict |
|---|---|---|---|
| e.g. iPhone 15 / iOS 18 / Safari | iCloud Keychain | yes | PASS |
| e.g. Win11 23H2 / Edge | Windows Hello | … | … |

If any primary family device **FAILS**, that informs the rollout: per the design decision,
a non-PRF device must enroll a PRF-capable passkey (synced platform passkey or security key)
rather than fall back to server-side decryption.

## Cleanup
Click **Reset spike state** (clears `localStorage`), then delete `scripts/spikes/` before
or during the real `OFF-4` implementation. It is intentionally not wired into the app.
