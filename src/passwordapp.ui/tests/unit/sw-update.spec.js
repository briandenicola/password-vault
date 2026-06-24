import { describe, it, expect, vi } from 'vitest';
import { skipWaiting, reloadOnControllerChange } from '@/components/pwa/sw-update.js';

describe('skipWaiting', () => {
  it('posts SKIP_WAITING to the waiting worker and returns true', () => {
    const post = vi.fn();
    const waiting = {};
    const ok = skipWaiting({ waiting }, post);
    expect(ok).toBe(true);
    expect(post).toHaveBeenCalledWith(waiting, { type: 'SKIP_WAITING' });
  });

  it('uses the worker.postMessage by default', () => {
    const waiting = { postMessage: vi.fn() };
    skipWaiting({ waiting });
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('returns false when there is no waiting worker', () => {
    expect(skipWaiting({ waiting: null }, vi.fn())).toBe(false);
    expect(skipWaiting(null, vi.fn())).toBe(false);
  });
});

describe('reloadOnControllerChange', () => {
  function fakeServiceWorker() {
    const handlers = [];
    return {
      addEventListener: (type, h) => { if (type === 'controllerchange') handlers.push(h); },
      removeEventListener: (type, h) => {
        const i = handlers.indexOf(h);
        if (i !== -1) handlers.splice(i, 1);
      },
      fire: () => handlers.slice().forEach(h => h()),
      count: () => handlers.length,
    };
  }

  it('reloads exactly once even if controllerchange fires repeatedly', () => {
    const sw = fakeServiceWorker();
    const reload = vi.fn();
    reloadOnControllerChange(sw, reload);
    sw.fire();
    sw.fire();
    sw.fire();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe removes the listener', () => {
    const sw = fakeServiceWorker();
    const reload = vi.fn();
    const off = reloadOnControllerChange(sw, reload);
    expect(sw.count()).toBe(1);
    off();
    expect(sw.count()).toBe(0);
    sw.fire();
    expect(reload).not.toHaveBeenCalled();
  });
});
