import {
  DEFAULT_PASSWORD_OPTIONS,
  DEFAULT_PASSPHRASE_OPTIONS,
} from '@/components/utils/generator.js';

const STORAGE_PREFIX = 'pv:settings:';

// Canonical default preferences. New keys added here are automatically backfilled
// onto previously-saved settings via the deep merge in loadSettings().
export function defaultSettings() {
  return {
    generator: {
      mode: 'password', // 'password' | 'passphrase'
      password: { ...DEFAULT_PASSWORD_OPTIONS },
      passphrase: { ...DEFAULT_PASSPHRASE_OPTIONS },
    },
    list: {
      sortBy: 'siteName', // 'accountName' | 'siteName' | 'lastModifiedDate'
      sortDesc: false,
      perPage: 10,
      staleAfterMonths: 24, // flag passwords at least this old; 0 = never
    },
    security: {
      clipboardClearSeconds: 30, // 0 = never auto-clear
      autoLockMinutes: 5, // 0 = never auto-lock
    },
  };
}

function storageKey(userId) {
  return STORAGE_PREFIX + (userId && String(userId).trim() ? userId : 'default');
}

// localStorage may be unavailable (private mode, tests). Fall back to a no-op shim
// so the app keeps working with in-memory defaults.
function resolveStorage(storage) {
  if (storage) {
    return storage;
  }
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    /* access can throw in some sandboxed contexts */
  }
  return null;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Recursively fill missing keys of `base` (a fresh defaults object) from `override`,
// only accepting override values whose type matches the default. This keeps stored
// settings forward-compatible and ignores corrupt/foreign fields.
function mergeDefaults(base, override) {
  if (!isObject(override)) {
    return base;
  }
  for (const key of Object.keys(base)) {
    if (!(key in override)) {
      continue;
    }
    const baseVal = base[key];
    const overrideVal = override[key];
    if (isObject(baseVal)) {
      base[key] = mergeDefaults(baseVal, overrideVal);
    } else if (typeof baseVal === typeof overrideVal && !Array.isArray(overrideVal)) {
      base[key] = overrideVal;
    }
  }
  return base;
}

export function loadSettings(userId, storage) {
  const defaults = defaultSettings();
  const store = resolveStorage(storage);
  if (!store) {
    return defaults;
  }

  let raw;
  try {
    raw = store.getItem(storageKey(userId));
  } catch {
    return defaults;
  }
  if (!raw) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw);
    return mergeDefaults(defaults, parsed);
  } catch {
    // Corrupt JSON — fall back to defaults rather than throwing.
    return defaults;
  }
}

export function saveSettings(userId, settings, storage) {
  const store = resolveStorage(storage);
  if (!store) {
    return false;
  }
  // Normalize through the merge so only known keys are persisted.
  const normalized = mergeDefaults(defaultSettings(), settings);
  try {
    store.setItem(storageKey(userId), JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function resetSettings(userId, storage) {
  const store = resolveStorage(storage);
  if (!store) {
    return defaultSettings();
  }
  try {
    store.removeItem(storageKey(userId));
  } catch {
    /* ignore */
  }
  return defaultSettings();
}
