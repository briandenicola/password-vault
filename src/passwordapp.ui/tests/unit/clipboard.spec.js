import { describe, it, expect, beforeEach, vi } from 'vitest';
import { copyWithAutoClear, _resetPendingClear } from '@/components/utils/clipboard.js';

function fakeClipboard() {
  return {
    writes: [],
    writeText(text) {
      this.writes.push(text);
      return Promise.resolve();
    },
  };
}

describe('copyWithAutoClear', () => {
  beforeEach(() => {
    _resetPendingClear();
  });

  it('writes the text to the clipboard', async () => {
    const clipboard = fakeClipboard();
    await copyWithAutoClear('hunter2', 0, { clipboard });
    expect(clipboard.writes).toEqual(['hunter2']);
  });

  it('schedules a clear after the configured delay', async () => {
    const clipboard = fakeClipboard();
    let captured = null;
    const setTimer = (fn, ms) => { captured = { fn, ms }; return 1; };
    await copyWithAutoClear('hunter2', 30, { clipboard, setTimer });
    expect(captured.ms).toBe(30000);
    captured.fn();
    expect(clipboard.writes).toEqual(['hunter2', '']);
  });

  it('does not schedule a clear when seconds is 0', async () => {
    const clipboard = fakeClipboard();
    const setTimer = vi.fn();
    await copyWithAutoClear('hunter2', 0, { clipboard, setTimer });
    expect(setTimer).not.toHaveBeenCalled();
  });

  it('resets a pending clear when a newer copy happens', async () => {
    const clipboard = fakeClipboard();
    const clearTimer = vi.fn();
    let handle = 0;
    const setTimer = () => ++handle;
    await copyWithAutoClear('first', 30, { clipboard, setTimer, clearTimer });
    await copyWithAutoClear('second', 30, { clipboard, setTimer, clearTimer });
    expect(clearTimer).toHaveBeenCalledWith(1);
  });

  it('rejects when the clipboard API is unavailable', async () => {
    await expect(copyWithAutoClear('x', 30, { clipboard: undefined }))
      .rejects.toThrow('Clipboard API unavailable');
  });
});
