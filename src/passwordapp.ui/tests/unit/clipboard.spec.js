import { describe, it, expect, beforeEach, vi } from 'vitest';
import { copyWithAutoClear, writeClipboardText, _resetPendingClear } from '@/components/utils/clipboard.js';

function fakeClipboard() {
  return {
    writes: [],
    writeText(text) {
      this.writes.push(text);
      return Promise.resolve();
    },
  };
}

function fakeDocument(execResult = true) {
  const element = {
    value: '',
    style: {},
    setAttribute: vi.fn(),
    focus: vi.fn(),
    select: vi.fn(),
    setSelectionRange: vi.fn(),
  };
  return {
    element,
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    },
    createElement: vi.fn(() => element),
    execCommand: vi.fn(() => execResult),
  };
}

describe('writeClipboardText', () => {
  it('falls back to execCommand when clipboard.writeText is rejected', async () => {
    const clipboard = { writeText: vi.fn(() => Promise.reject(new DOMException('NotAllowedError'))) };
    const documentRef = fakeDocument();
    await writeClipboardText('ios-secret', { clipboard, documentRef });
    expect(documentRef.element.value).toBe('ios-secret');
    expect(documentRef.execCommand).toHaveBeenCalledWith('copy');
    expect(documentRef.body.removeChild).toHaveBeenCalledWith(documentRef.element);
  });

  it('uses the legacy copy path when the Clipboard API is unavailable', async () => {
    const documentRef = fakeDocument();
    await writeClipboardText('legacy-secret', { clipboard: undefined, documentRef });
    expect(documentRef.element.value).toBe('legacy-secret');
    expect(documentRef.execCommand).toHaveBeenCalledWith('copy');
  });

  it('rejects when neither clipboard API nor legacy copy is available', async () => {
    await expect(writeClipboardText('x', { clipboard: undefined, documentRef: undefined }))
      .rejects.toThrow('Clipboard API unavailable');
  });
});

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
    await expect(copyWithAutoClear('x', 30, { clipboard: undefined, documentRef: undefined }))
      .rejects.toThrow('Clipboard API unavailable');
  });
});
