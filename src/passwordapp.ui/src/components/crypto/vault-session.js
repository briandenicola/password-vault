// OFF-4 (E2EE) Phase 2b — in-memory DEK state + auto-lock (UI-2).
// See docs/design/e2ee.md §4 (key management) and §7 (auto-lock).
//
// Once the vault is unlocked (passkey PRF or recovery key — Phase 2c), the usable
// Data Encryption Key lives ONLY here, in module memory, as a non-extractable
// AES-GCM CryptoKey. It is never written to localStorage, sessionStorage, IndexedDB
// or any cookie, so it cannot survive a tab close, reload, or device theft of
// at-rest storage. `lock()` drops it; the idle auto-lock calls `lock()` so an
// unattended device returns to a locked state after the configured timeout.

import { IdleTimer } from '../utils/idle-timer.js';

export class VaultSession {
  constructor() {
    this._dek = null; // non-extractable CryptoKey, or null when locked
    this._unlockedAt = null;
    this._listeners = new Set();
    this._autoLock = null;
  }

  get isUnlocked() {
    return this._dek !== null;
  }

  get unlockedAt() {
    return this._unlockedAt;
  }

  // Store the unwrapped DEK and mark the vault unlocked. Re-arms the idle timer
  // (if one was configured) so the lock countdown starts from unlock.
  unlock(dekKey) {
    if (!dekKey) {
      throw new Error('A DEK is required to unlock the vault.');
    }
    this._dek = dekKey;
    this._unlockedAt = Date.now();
    if (this._autoLock) {
      this._autoLock.start();
    }
    this._emit();
    return this;
  }

  // Return the in-memory DEK. Throws when locked so callers fail loudly rather
  // than silently encrypting/decrypting with a null key.
  getDek() {
    if (this._dek === null) {
      throw new Error('Vault is locked.');
    }
    return this._dek;
  }

  // Drop the DEK. Idempotent: locking an already-locked vault is a no-op and does
  // not emit a redundant transition.
  lock() {
    if (this._dek === null) {
      return this;
    }
    this._dek = null;
    this._unlockedAt = null;
    if (this._autoLock) {
      this._autoLock.stop();
    }
    this._emit();
    return this;
  }

  // Subscribe to lock/unlock transitions. The listener receives a snapshot
  // { isUnlocked, unlockedAt }. Returns an unsubscribe function.
  subscribe(listener) {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  // Configure idle auto-lock. timeoutMs <= 0 disables it. Timer functions are
  // injectable for deterministic tests. If the vault is already unlocked, the
  // timer is armed immediately.
  configureAutoLock({ timeoutMs, setTimer, clearTimer } = {}) {
    if (this._autoLock) {
      this._autoLock.stop();
    }
    this._autoLock = new IdleTimer({
      timeoutMs,
      onIdle: () => this.lock(),
      setTimer,
      clearTimer,
    });
    if (this.isUnlocked) {
      this._autoLock.start();
    }
    return this;
  }

  // Re-arm the idle timer on user activity. Safe to call when no timer is set.
  notifyActivity() {
    if (this._autoLock) {
      this._autoLock.notifyActivity();
    }
  }

  _emit() {
    const snapshot = { isUnlocked: this.isUnlocked, unlockedAt: this._unlockedAt };
    for (const listener of this._listeners) {
      try {
        listener(snapshot);
      } catch (e) {
        // A misbehaving subscriber must not break the others or leave the DEK set.
      }
    }
  }
}

// App-wide singleton: the DEK lives here, in memory only, never persisted.
export const vaultSession = new VaultSession();

export default vaultSession;
