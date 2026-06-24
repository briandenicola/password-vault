import WORDLIST from './wordlist.js';

// Character classes used by the password generator.
export const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
export const DIGITS = '0123456789';
export const SYMBOLS = "!@#$%^&*()_+[]{}|;:,.<>?/~-=";

// Visually confusable characters removed when "exclude ambiguous" is on.
export const AMBIGUOUS = new Set("O0oiIlL1|`'\"".split(''));

const UINT32_RANGE = 0x100000000; // 2^32

// Default source of randomness. Injectable so the logic can be unit-tested deterministically.
function defaultRandomBytes(buffer) {
  crypto.getRandomValues(buffer);
  return buffer;
}

/**
 * Uniformly random integer in [0, maxExclusive) with NO modulo bias.
 *
 * The naive `crypto.getRandomValues(...)[0] % n` is biased whenever `n` does not
 * evenly divide 2^32: the lowest `2^32 % n` values are slightly more likely. We use
 * rejection sampling — discard any draw that falls in the final, incomplete bucket —
 * so every value in range is equally likely (GE-4).
 */
export function secureRandomBelow(maxExclusive, randomBytes = defaultRandomBytes) {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError('maxExclusive must be a positive integer');
  }
  if (maxExclusive === 1) {
    return 0;
  }

  // Largest multiple of maxExclusive that fits in a uint32; draws at/above it are rejected.
  const limit = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);

  let value;
  do {
    randomBytes(buffer);
    value = buffer[0];
  } while (value >= limit);

  return value % maxExclusive;
}

function randomChar(charset, randomBytes) {
  return charset[secureRandomBelow(charset.length, randomBytes)];
}

/** In-place, unbiased Fisher-Yates shuffle. */
export function shuffle(array, randomBytes = defaultRandomBytes) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = secureRandomBelow(i + 1, randomBytes);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function filterAmbiguous(charset, exclude) {
  if (!exclude) {
    return charset;
  }
  return charset
    .split('')
    .filter((c) => !AMBIGUOUS.has(c))
    .join('');
}

function log2(n) {
  return Math.log(n) / Math.log(2);
}

export const DEFAULT_PASSWORD_OPTIONS = Object.freeze({
  length: 16,
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
});

/**
 * Generate a random password from the selected character classes.
 * Guarantees at least one character from each selected class when the requested
 * length allows it, then fills and shuffles the rest (unbiased throughout).
 *
 * @returns {string}
 * @throws {Error} if no character class is selected or the resulting pool is empty.
 */
export function generatePassword(options = {}, randomBytes = defaultRandomBytes) {
  const opts = { ...DEFAULT_PASSWORD_OPTIONS, ...options };
  const length = Number(opts.length);

  if (!Number.isInteger(length) || length <= 0) {
    throw new RangeError('length must be a positive integer');
  }

  const classes = [];
  if (opts.uppercase) classes.push(filterAmbiguous(UPPERCASE, opts.excludeAmbiguous));
  if (opts.lowercase) classes.push(filterAmbiguous(LOWERCASE, opts.excludeAmbiguous));
  if (opts.digits) classes.push(filterAmbiguous(DIGITS, opts.excludeAmbiguous));
  if (opts.symbols) classes.push(filterAmbiguous(SYMBOLS, opts.excludeAmbiguous));

  const usableClasses = classes.filter((c) => c.length > 0);
  if (usableClasses.length === 0) {
    throw new Error('Select at least one character set.');
  }

  const pool = usableClasses.join('');
  const chars = [];

  // Guarantee one char from each class only if there's room for all of them.
  if (length >= usableClasses.length) {
    for (const charset of usableClasses) {
      chars.push(randomChar(charset, randomBytes));
    }
  }

  while (chars.length < length) {
    chars.push(randomChar(pool, randomBytes));
  }

  shuffle(chars, randomBytes);
  return chars.join('');
}

export const DEFAULT_PASSPHRASE_OPTIONS = Object.freeze({
  words: 5,
  separator: '-',
  capitalize: true,
  includeNumber: true,
});

/**
 * Generate a diceware-style passphrase from the EFF large wordlist.
 * @returns {string}
 */
export function generatePassphrase(options = {}, randomBytes = defaultRandomBytes) {
  const opts = { ...DEFAULT_PASSPHRASE_OPTIONS, ...options };
  const wordlist = opts.wordlist ?? WORDLIST;
  const count = Number(opts.words);

  if (!Number.isInteger(count) || count <= 0) {
    throw new RangeError('words must be a positive integer');
  }
  if (!Array.isArray(wordlist) || wordlist.length === 0) {
    throw new Error('wordlist must be a non-empty array');
  }

  const parts = [];
  for (let i = 0; i < count; i++) {
    let word = wordlist[secureRandomBelow(wordlist.length, randomBytes)];
    if (opts.capitalize) {
      word = word.charAt(0).toUpperCase() + word.slice(1);
    }
    parts.push(word);
  }

  let phrase = parts.join(opts.separator);

  if (opts.includeNumber) {
    // A two-digit number (10-99) appended as its own token.
    const number = 10 + secureRandomBelow(90, randomBytes);
    phrase += opts.separator + number;
  }

  return phrase;
}

/** Approximate entropy (in bits) for the given password options. */
export function passwordEntropyBits(options = {}) {
  const opts = { ...DEFAULT_PASSWORD_OPTIONS, ...options };
  let poolSize = 0;
  if (opts.uppercase) poolSize += filterAmbiguous(UPPERCASE, opts.excludeAmbiguous).length;
  if (opts.lowercase) poolSize += filterAmbiguous(LOWERCASE, opts.excludeAmbiguous).length;
  if (opts.digits) poolSize += filterAmbiguous(DIGITS, opts.excludeAmbiguous).length;
  if (opts.symbols) poolSize += filterAmbiguous(SYMBOLS, opts.excludeAmbiguous).length;

  if (poolSize === 0 || opts.length <= 0) {
    return 0;
  }
  return Math.round(opts.length * log2(poolSize));
}

/** Approximate entropy (in bits) for the given passphrase options. */
export function passphraseEntropyBits(options = {}) {
  const opts = { ...DEFAULT_PASSPHRASE_OPTIONS, ...options };
  const wordlist = opts.wordlist ?? WORDLIST;
  let bits = opts.words * log2(wordlist.length);
  if (opts.includeNumber) {
    bits += log2(90);
  }
  return Math.round(bits);
}
