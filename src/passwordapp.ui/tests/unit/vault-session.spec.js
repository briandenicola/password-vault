import { describe, it, expect, vi } from 'vitest';
import { VaultSession } from '@/components/crypto/vault-session.js';

// A stand-in for a non-extractable DEK CryptoKey. The session only stores and
// hands back the reference; it never inspects it.
const fakeDek = () => ({ type: 'secret', algorithm: { name: 'AES-GCM' } });

describe('VaultSession lock state', () => {
  it('starts locked', () => {
    const s = new VaultSession();
    expect(s.isUnlocked).toBe(false);
    expect(s.unlockedAt).toBeNull();
    expect(() => s.getDek()).toThrow(/locked/i);
  });

  it('unlock stores the DEK and exposes it via getDek', () => {
    const s = new VaultSession();
    const dek = fakeDek();
    s.unlock(dek);
    expect(s.isUnlocked).toBe(true);
    expect(s.getDek()).toBe(dek);
    expect(typeof s.unlockedAt).toBe('number');
  });

  it('unlock without a DEK throws', () => {
    const s = new VaultSession();
    expect(() => s.unlock(null)).toThrow(/required/i);
    expect(() => s.unlock(undefined)).toThrow(/required/i);
    expect(s.isUnlocked).toBe(false);
  });

  it('lock drops the DEK', () => {
    const s = new VaultSession();
    s.unlock(fakeDek());
    s.lock();
    expect(s.isUnlocked).toBe(false);
    expect(s.unlockedAt).toBeNull();
    expect(() => s.getDek()).toThrow(/locked/i);
  });

  it('lock is idempotent and does not emit when already locked', () => {
    const s = new VaultSession();
    const listener = vi.fn();
    s.subscribe(listener);
    s.lock(); // already locked
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('VaultSession does not persist the DEK', () => {
  it('writes the key to no Web Storage API', () => {
    const local = { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn() };
    const session = { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn() };
    const prevLocal = globalThis.localStorage;
    const prevSession = globalThis.sessionStorage;
    globalThis.localStorage = local;
    globalThis.sessionStorage = session;
    try {
      const s = new VaultSession();
      s.unlock(fakeDek());
      s.getDek();
      s.lock();
      expect(local.setItem).not.toHaveBeenCalled();
      expect(session.setItem).not.toHaveBeenCalled();
    } finally {
      globalThis.localStorage = prevLocal;
      globalThis.sessionStorage = prevSession;
    }
  });
});

describe('VaultSession subscriptions', () => {
  it('notifies subscribers on unlock and lock with a snapshot', () => {
    const s = new VaultSession();
    const events = [];
    s.subscribe((snap) => events.push(snap));
    s.unlock(fakeDek());
    s.lock();
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ isUnlocked: true });
    expect(typeof events[0].unlockedAt).toBe('number');
    expect(events[1]).toMatchObject({ isUnlocked: false, unlockedAt: null });
  });

  it('unsubscribe stops further notifications', () => {
    const s = new VaultSession();
    const listener = vi.fn();
    const off = s.subscribe(listener);
    s.unlock(fakeDek());
    off();
    s.lock();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('a throwing subscriber does not prevent others or break locking', () => {
    const s = new VaultSession();
    const good = vi.fn();
    s.subscribe(() => {
      throw new Error('boom');
    });
    s.subscribe(good);
    expect(() => s.unlock(fakeDek())).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
    expect(s.isUnlocked).toBe(true);
  });
});

describe('VaultSession auto-lock', () => {
  // Inject a controllable timer so we can fire the idle callback deterministically.
  function makeManualTimer() {
    let pending = null;
    return {
      setTimer: (fn) => {
        pending = fn;
        return 1;
      },
      clearTimer: () => {
        pending = null;
      },
      fire: () => {
        if (pending) {
          const fn = pending;
          pending = null;
          fn();
        }
      },
      hasPending: () => pending !== null,
    };
  }

  it('locks the vault when the idle timer fires', () => {
    const timer = makeManualTimer();
    const s = new VaultSession();
    s.configureAutoLock({ timeoutMs: 1000, setTimer: timer.setTimer, clearTimer: timer.clearTimer });
    s.unlock(fakeDek());
    expect(s.isUnlocked).toBe(true);
    expect(timer.hasPending()).toBe(true);
    timer.fire();
    expect(s.isUnlocked).toBe(false);
  });

  it('notifyActivity re-arms the timer before it fires', () => {
    const timer = makeManualTimer();
    const s = new VaultSession();
    s.configureAutoLock({ timeoutMs: 1000, setTimer: timer.setTimer, clearTimer: timer.clearTimer });
    s.unlock(fakeDek());
    s.notifyActivity();
    expect(timer.hasPending()).toBe(true);
    expect(s.isUnlocked).toBe(true);
  });

  it('timeoutMs of 0 disables auto-lock', () => {
    const timer = makeManualTimer();
    const s = new VaultSession();
    s.configureAutoLock({ timeoutMs: 0, setTimer: timer.setTimer, clearTimer: timer.clearTimer });
    s.unlock(fakeDek());
    expect(timer.hasPending()).toBe(false);
    timer.fire(); // nothing pending
    expect(s.isUnlocked).toBe(true);
  });

  it('locking manually stops the pending idle timer', () => {
    const timer = makeManualTimer();
    const s = new VaultSession();
    s.configureAutoLock({ timeoutMs: 1000, setTimer: timer.setTimer, clearTimer: timer.clearTimer });
    s.unlock(fakeDek());
    s.lock();
    expect(timer.hasPending()).toBe(false);
  });
});
