import { describe, it, expect, beforeEach } from 'vitest';
import {
  defaultSettings,
  loadSettings,
  saveSettings,
  resetSettings,
} from '../../src/components/settings/settings.store.js';

// Minimal in-memory localStorage stand-in.
function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

let storage;
beforeEach(() => {
  storage = fakeStorage();
});

describe('settings.store', () => {
  it('returns defaults when nothing is stored', () => {
    const s = loadSettings('alice', storage);
    expect(s).toEqual(defaultSettings());
  });

  it('round-trips saved settings', () => {
    const s = defaultSettings();
    s.generator.password.length = 32;
    s.list.perPage = 50;
    s.list.sortBy = 'accountName';

    expect(saveSettings('alice', s, storage)).toBe(true);

    const loaded = loadSettings('alice', storage);
    expect(loaded.generator.password.length).toBe(32);
    expect(loaded.list.perPage).toBe(50);
    expect(loaded.list.sortBy).toBe('accountName');
  });

  it('backfills missing keys from defaults (forward compatibility)', () => {
    // Simulate an older, partial settings blob.
    storage.setItem('pv:settings:alice', JSON.stringify({ list: { perPage: 20 } }));

    const loaded = loadSettings('alice', storage);
    expect(loaded.list.perPage).toBe(20); // preserved
    expect(loaded.list.sortBy).toBe('siteName'); // backfilled
    expect(loaded.generator.mode).toBe('password'); // backfilled
    expect(loaded.generator.password.length).toBe(defaultSettings().generator.password.length);
    expect(loaded.security.clipboardClearSeconds).toBe(defaultSettings().security.clipboardClearSeconds); // backfilled
    expect(loaded.appearance.theme).toBe('vault'); // backfilled
  });

  it('preserves and persists security preferences', () => {
    const s = defaultSettings();
    s.security.clipboardClearSeconds = 10;
    s.security.autoLockMinutes = 15;
    expect(saveSettings('alice', s, storage)).toBe(true);
    const loaded = loadSettings('alice', storage);
    expect(loaded.security.clipboardClearSeconds).toBe(10);
    expect(loaded.security.autoLockMinutes).toBe(15);
  });

  it('preserves and persists appearance preferences', () => {
    const s = defaultSettings();
    s.appearance.theme = 'classic';
    expect(saveSettings('alice', s, storage)).toBe(true);
    expect(loadSettings('alice', storage).appearance.theme).toBe('classic');
  });

  it('ignores foreign / wrong-typed fields', () => {
    storage.setItem(
      'pv:settings:alice',
      JSON.stringify({ list: { perPage: 'not-a-number' }, bogus: true }),
    );
    const loaded = loadSettings('alice', storage);
    expect(loaded.list.perPage).toBe(defaultSettings().list.perPage); // rejected wrong type
    expect('bogus' in loaded).toBe(false);
  });

  it('falls back to defaults on corrupt JSON', () => {
    storage.setItem('pv:settings:alice', '{ not valid json');
    expect(loadSettings('alice', storage)).toEqual(defaultSettings());
  });

  it('isolates settings per user', () => {
    const a = defaultSettings();
    a.list.perPage = 5;
    saveSettings('alice', a, storage);

    const b = defaultSettings();
    b.list.perPage = 100;
    saveSettings('bob', b, storage);

    expect(loadSettings('alice', storage).list.perPage).toBe(5);
    expect(loadSettings('bob', storage).list.perPage).toBe(100);
  });

  it('uses a shared default key when no user id is given', () => {
    const s = defaultSettings();
    s.list.perPage = 25;
    saveSettings(null, s, storage);
    expect(loadSettings(undefined, storage).list.perPage).toBe(25);
  });

  it('reset removes stored settings and returns defaults', () => {
    const s = defaultSettings();
    s.list.perPage = 50;
    saveSettings('alice', s, storage);

    const reset = resetSettings('alice', storage);
    expect(reset).toEqual(defaultSettings());
    expect(loadSettings('alice', storage)).toEqual(defaultSettings());
  });

  it('only persists known keys (normalized on save)', () => {
    const s = defaultSettings();
    s.extra = 'nope';
    saveSettings('alice', s, storage);
    const stored = JSON.parse(storage.getItem('pv:settings:alice'));
    expect('extra' in stored).toBe(false);
  });

  it('returns defaults gracefully when storage is unavailable', () => {
    expect(loadSettings('alice', null)).toEqual(defaultSettings());
    expect(saveSettings('alice', defaultSettings(), null)).toBe(false);
  });
});
