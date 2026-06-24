import { describe, it, expect, vi } from 'vitest';
import { IdleTimer } from '@/components/utils/idle-timer.js';

// Minimal controllable fake timer.
function fakeTimers() {
  let handle = 0;
  const scheduled = new Map();
  return {
    setTimer: (fn, ms) => { const id = ++handle; scheduled.set(id, { fn, ms }); return id; },
    clearTimer: (id) => { scheduled.delete(id); },
    fire: (id) => { const t = scheduled.get(id); scheduled.delete(id); t.fn(); },
    pending: () => scheduled.size,
    last: () => handle,
  };
}

describe('IdleTimer', () => {
  it('fires onIdle after the timeout elapses', () => {
    const t = fakeTimers();
    const onIdle = vi.fn();
    const timer = new IdleTimer({ timeoutMs: 1000, onIdle, setTimer: t.setTimer, clearTimer: t.clearTimer }).start();
    t.fire(t.last());
    expect(onIdle).toHaveBeenCalledTimes(1);
    timer.stop();
  });

  it('re-arms on activity instead of firing', () => {
    const t = fakeTimers();
    const onIdle = vi.fn();
    const timer = new IdleTimer({ timeoutMs: 1000, onIdle, setTimer: t.setTimer, clearTimer: t.clearTimer }).start();
    const first = t.last();
    timer.notifyActivity();
    expect(t.pending()).toBe(1); // old cleared, new armed
    expect(t.last()).toBe(first + 1);
    timer.stop();
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('does not arm when timeout is 0', () => {
    const t = fakeTimers();
    const onIdle = vi.fn();
    new IdleTimer({ timeoutMs: 0, onIdle, setTimer: t.setTimer, clearTimer: t.clearTimer }).start();
    expect(t.pending()).toBe(0);
  });

  it('stop cancels the pending timer', () => {
    const t = fakeTimers();
    const onIdle = vi.fn();
    const timer = new IdleTimer({ timeoutMs: 1000, onIdle, setTimer: t.setTimer, clearTimer: t.clearTimer }).start();
    timer.stop();
    expect(t.pending()).toBe(0);
  });

  it('ignores activity after firing until restarted', () => {
    const t = fakeTimers();
    const onIdle = vi.fn();
    const timer = new IdleTimer({ timeoutMs: 1000, onIdle, setTimer: t.setTimer, clearTimer: t.clearTimer }).start();
    t.fire(t.last());
    timer.notifyActivity();
    expect(t.pending()).toBe(0);
  });
});
