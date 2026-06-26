// Clipboard helper with timed auto-clear (UI-1).
//
// Copies text to the clipboard and, after `seconds`, overwrites the clipboard with an
// empty string so a copied secret doesn't linger indefinitely. A single shared timer is
// kept so a newer copy resets the countdown rather than stacking timers. Timers and the
// clipboard object are injectable for testing.

let pendingClear = null;

function legacyCopyText(text, documentRef) {
  const doc = documentRef || (typeof document !== 'undefined' ? document : undefined);
  if (!doc || !doc.body || typeof doc.createElement !== 'function' || typeof doc.execCommand !== 'function') {
    return Promise.reject(new Error('Clipboard API unavailable'));
  }

  const textarea = doc.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  doc.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;
  try {
    copied = doc.execCommand('copy');
  } finally {
    doc.body.removeChild(textarea);
  }
  return copied
    ? Promise.resolve()
    : Promise.reject(new Error('Clipboard copy failed'));
}

export function writeClipboardText(text, deps = {}) {
  const {
    clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined,
    documentRef = typeof document !== 'undefined' ? document : undefined,
  } = deps;

  if (clipboard && typeof clipboard.writeText === 'function') {
    return Promise.resolve(clipboard.writeText(text))
      .catch(primaryError => legacyCopyText(text, documentRef)
        .catch(() => { throw primaryError; }));
  }

  return legacyCopyText(text, documentRef);
}

function scheduleAutoClear(clipboard, documentRef, seconds, setTimer, clearTimer) {
  if (pendingClear !== null) {
    clearTimer(pendingClear);
    pendingClear = null;
  }

  const secs = Number(seconds);
  if (Number.isFinite(secs) && secs > 0) {
    pendingClear = setTimer(() => {
      pendingClear = null;
      // Best-effort: ignore failures (e.g. document lost focus).
      writeClipboardText('', { clipboard, documentRef }).catch(() => {});
    }, secs * 1000);
  }
}

export function copyWithAutoClear(text, seconds, deps = {}) {
  const {
    clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined,
    documentRef = typeof document !== 'undefined' ? document : undefined,
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (id) => clearTimeout(id),
  } = deps;

  return writeClipboardText(text, { clipboard, documentRef }).then(() => {
    scheduleAutoClear(clipboard, documentRef, seconds, setTimer, clearTimer);
    return true;
  });
}

export function copyDeferredTextWithAutoClear(textPromise, seconds, deps = {}) {
  const {
    clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined,
    documentRef = typeof document !== 'undefined' ? document : undefined,
    ClipboardItemCtor = typeof ClipboardItem !== 'undefined' ? ClipboardItem : undefined,
    BlobCtor = typeof Blob !== 'undefined' ? Blob : undefined,
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (id) => clearTimeout(id),
  } = deps;

  if (
    clipboard &&
    typeof clipboard.write === 'function' &&
    typeof ClipboardItemCtor === 'function' &&
    typeof BlobCtor === 'function'
  ) {
    const item = new ClipboardItemCtor({
      'text/plain': Promise.resolve(textPromise)
        .then(text => new BlobCtor([text], { type: 'text/plain' })),
    });
    return Promise.resolve(clipboard.write([item])).then(() => {
      scheduleAutoClear(clipboard, documentRef, seconds, setTimer, clearTimer);
      return true;
    });
  }

  return Promise.resolve(textPromise)
    .then(text => copyWithAutoClear(text, seconds, {
      clipboard,
      documentRef,
      setTimer,
      clearTimer,
    }));
}

// Exposed for tests to reset module state between cases.
export function _resetPendingClear() {
  pendingClear = null;
}
