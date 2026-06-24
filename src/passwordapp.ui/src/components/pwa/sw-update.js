// Helpers for the service-worker update flow. The reload-once guard and the
// skip-waiting message are kept here (separate from the Vue component) so they
// can be unit-tested without a real service-worker lifecycle.

// Tell the waiting service worker to activate now. Returns true if a waiting
// worker was actually messaged. The page reload is driven by the
// 'controllerchange' event (see reloadOnControllerChange) rather than here, so
// we don't reload before the new worker has taken control.
export function skipWaiting(registration, postMessage) {
  const waiting = registration && registration.waiting;
  if (!waiting) {
    return false;
  }
  const send = postMessage || ((worker, message) => worker.postMessage(message));
  send(waiting, { type: 'SKIP_WAITING' });
  return true;
}

// Reload exactly once when the active service worker changes. Guards against the
// double reload that can happen when 'controllerchange' fires more than once.
// Returns an unsubscribe function.
export function reloadOnControllerChange(serviceWorker, reload) {
  let reloaded = false;
  const handler = () => {
    if (reloaded) {
      return;
    }
    reloaded = true;
    reload();
  };
  serviceWorker.addEventListener('controllerchange', handler);
  return () => serviceWorker.removeEventListener('controllerchange', handler);
}
