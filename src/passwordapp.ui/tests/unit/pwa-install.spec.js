import { describe, it, expect, vi } from 'vitest';
import { isStandalone, shouldShowInstallPrompt, promptInstall } from '@/components/pwa/install.js';

describe('isStandalone', () => {
  it('detects display-mode standalone', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    expect(isStandalone(matchMedia, {})).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(display-mode: standalone)');
  });

  it('detects iOS standalone mode', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: false });
    expect(isStandalone(matchMedia, { standalone: true })).toBe(true);
  });

  it('returns false for a regular browser tab', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: false });
    expect(isStandalone(matchMedia, { standalone: false })).toBe(false);
  });
});

describe('shouldShowInstallPrompt', () => {
  it('shows the install prompt only when installable and not already standalone', () => {
    expect(shouldShowInstallPrompt({ prompt: vi.fn() }, false)).toBe(true);
    expect(shouldShowInstallPrompt({ prompt: vi.fn() }, true)).toBe(false);
    expect(shouldShowInstallPrompt(null, false)).toBe(false);
  });
});

describe('promptInstall', () => {
  it('calls the deferred prompt and returns the browser choice', async () => {
    const choice = Promise.resolve({ outcome: 'accepted' });
    const event = { prompt: vi.fn(), userChoice: choice };
    await expect(promptInstall(event)).resolves.toEqual({ outcome: 'accepted' });
    expect(event.prompt).toHaveBeenCalledTimes(1);
  });

  it('does not fail when the browser event is unavailable', async () => {
    await expect(promptInstall(null)).resolves.toBeNull();
  });
});
