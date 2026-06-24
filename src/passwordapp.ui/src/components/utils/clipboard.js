// Clipboard helper with timed auto-clear (UI-1).
//
// Copies text to the clipboard and, after `seconds`, overwrites the clipboard with an
// empty string so a copied secret doesn't linger indefinitely. A single shared timer is
// kept so a newer copy resets the countdown rather than stacking timers. Timers and the
// clipboard object are injectable for testing.

let pendingClear = null;

export function copyWithAutoClear(text, seconds, deps = {}) {
  const {
    clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined,
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (id) => clearTimeout(id),
  } = deps;

  if (!clipboard || typeof clipboard.writeText !== 'function') {
    return Promise.reject(new Error('Clipboard API unavailable'));
  }

  return clipboard.writeText(text).then(() => {
    if (pendingClear !== null) {
      clearTimer(pendingClear);
      pendingClear = null;
    }

    const secs = Number(seconds);
    if (Number.isFinite(secs) && secs > 0) {
      pendingClear = setTimer(() => {
        pendingClear = null;
        // Best-effort: ignore failures (e.g. document lost focus).
        Promise.resolve(clipboard.writeText('')).catch(() => {});
      }, secs * 1000);
    }

    return true;
  });
}

// Exposed for tests to reset module state between cases.
export function _resetPendingClear() {
  pendingClear = null;
}
