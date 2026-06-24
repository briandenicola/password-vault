// Idle timer for auto-lock (UI-2).
//
// Fires `onIdle` once after `timeoutMs` of no activity. `notifyActivity()` re-arms the
// timer (call it from throttled user-activity listeners). A timeout of 0 disables the
// timer entirely. Timer functions are injectable for deterministic testing.

export class IdleTimer {
  constructor({ timeoutMs, onIdle, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (id) => clearTimeout(id) }) {
    this.timeoutMs = Number(timeoutMs) || 0;
    this.onIdle = onIdle;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this._handle = null;
    this._fired = false;
  }

  start() {
    this._fired = false;
    this._arm();
    return this;
  }

  notifyActivity() {
    // Once fired (locked) we stop re-arming until an explicit start().
    if (!this._fired) {
      this._arm();
    }
  }

  stop() {
    this._clear();
  }

  _arm() {
    this._clear();
    if (this.timeoutMs > 0) {
      this._handle = this.setTimer(() => {
        this._handle = null;
        this._fired = true;
        if (typeof this.onIdle === 'function') {
          this.onIdle();
        }
      }, this.timeoutMs);
    }
  }

  _clear() {
    if (this._handle !== null) {
      this.clearTimer(this._handle);
      this._handle = null;
    }
  }
}

export default IdleTimer;
