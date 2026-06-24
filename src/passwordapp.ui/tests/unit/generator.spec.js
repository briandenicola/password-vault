import { describe, it, expect } from 'vitest';
import {
  secureRandomBelow,
  shuffle,
  generatePassword,
  generatePassphrase,
  passwordEntropyBits,
  passphraseEntropyBits,
  AMBIGUOUS,
  UPPERCASE,
  LOWERCASE,
  DIGITS,
  SYMBOLS,
} from '../../src/components/utils/generator.js';

// A counting uint32 source: lets us drive secureRandomBelow deterministically and
// exercise the rejection path precisely. Each call writes the next value (mod 2^32).
function sequenceBytes(values) {
  let i = 0;
  return (buffer) => {
    buffer[0] = values[i % values.length];
    i += 1;
    return buffer;
  };
}

describe('secureRandomBelow', () => {
  it('returns 0 for maxExclusive of 1 without consuming randomness', () => {
    let called = false;
    const result = secureRandomBelow(1, () => {
      called = true;
    });
    expect(result).toBe(0);
    expect(called).toBe(false);
  });

  it('rejects values in the biased tail (rejection sampling)', () => {
    // For n = 3, limit = floor(2^32 / 3) * 3 = 4294967295. The value 4294967295
    // is >= limit and must be rejected; the next draw (0) is accepted -> 0.
    const bytes = sequenceBytes([4294967295, 0]);
    expect(secureRandomBelow(3, bytes)).toBe(0);
  });

  it('maps accepted values with modulo', () => {
    expect(secureRandomBelow(10, sequenceBytes([13]))).toBe(3);
    expect(secureRandomBelow(10, sequenceBytes([20]))).toBe(0);
  });

  it('throws on non-positive or non-integer bounds', () => {
    expect(() => secureRandomBelow(0)).toThrow();
    expect(() => secureRandomBelow(-5)).toThrow();
    expect(() => secureRandomBelow(2.5)).toThrow();
  });

  it('is statistically uniform across buckets', () => {
    const n = 7;
    const counts = new Array(n).fill(0);
    const draws = 70000;
    for (let i = 0; i < draws; i++) {
      counts[secureRandomBelow(n)] += 1;
    }
    const expected = draws / n;
    for (const c of counts) {
      // Allow a generous +/-15% band; a biased modulo impl skews far more than this.
      expect(Math.abs(c - expected) / expected).toBeLessThan(0.15);
    }
  });
});

describe('shuffle', () => {
  it('is a permutation (no loss or duplication)', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const out = shuffle([...input]);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });
});

describe('generatePassword', () => {
  it('produces a password of the requested length', () => {
    expect(generatePassword({ length: 24 })).toHaveLength(24);
  });

  it('defaults to a 16-char password with all classes', () => {
    const pw = generatePassword();
    expect(pw).toHaveLength(16);
    expect(/[A-Z]/.test(pw)).toBe(true);
    expect(/[a-z]/.test(pw)).toBe(true);
    expect(/[0-9]/.test(pw)).toBe(true);
  });

  it('guarantees at least one char from each selected class', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword({ length: 8, uppercase: true, lowercase: true, digits: true, symbols: true });
      expect(/[A-Z]/.test(pw)).toBe(true);
      expect(/[a-z]/.test(pw)).toBe(true);
      expect(/[0-9]/.test(pw)).toBe(true);
      expect([...pw].some((c) => SYMBOLS.includes(c))).toBe(true);
    }
  });

  it('honors disabled character classes', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword({ length: 20, uppercase: true, lowercase: true, digits: false, symbols: false });
      expect(/^[A-Za-z]+$/.test(pw)).toBe(true);
    }
  });

  it('excludes ambiguous characters when asked', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword({ length: 40, excludeAmbiguous: true });
      for (const ch of pw) {
        expect(AMBIGUOUS.has(ch)).toBe(false);
      }
    }
  });

  it('throws when no character class is selected', () => {
    expect(() =>
      generatePassword({ uppercase: false, lowercase: false, digits: false, symbols: false }),
    ).toThrow(/at least one/i);
  });

  it('throws on invalid length', () => {
    expect(() => generatePassword({ length: 0 })).toThrow();
    expect(() => generatePassword({ length: -3 })).toThrow();
  });
});

describe('generatePassphrase', () => {
  const wordlist = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];

  it('produces the requested number of words plus an optional number', () => {
    const phrase = generatePassphrase({ words: 4, separator: '-', includeNumber: false, capitalize: false, wordlist });
    const parts = phrase.split('-');
    expect(parts).toHaveLength(4);
    for (const p of parts) {
      expect(wordlist).toContain(p);
    }
  });

  it('appends a two-digit number when includeNumber is set', () => {
    const phrase = generatePassphrase({ words: 3, separator: '.', includeNumber: true, capitalize: false, wordlist });
    const parts = phrase.split('.');
    expect(parts).toHaveLength(4);
    expect(/^[1-9][0-9]$/.test(parts[3])).toBe(true);
  });

  it('capitalizes words when requested', () => {
    const phrase = generatePassphrase({ words: 3, includeNumber: false, capitalize: true, wordlist });
    for (const p of phrase.split('-')) {
      expect(/^[A-Z]/.test(p)).toBe(true);
    }
  });

  it('throws on invalid word count or empty wordlist', () => {
    expect(() => generatePassphrase({ words: 0, wordlist })).toThrow();
    expect(() => generatePassphrase({ words: 3, wordlist: [] })).toThrow();
  });
});

describe('entropy estimates', () => {
  it('computes password entropy from the active pool', () => {
    const full = UPPERCASE.length + LOWERCASE.length + DIGITS.length + SYMBOLS.length;
    expect(passwordEntropyBits({ length: 16 })).toBe(Math.round(16 * Math.log2(full)));
    // Disabling classes lowers entropy.
    expect(passwordEntropyBits({ length: 16, symbols: false, digits: false })).toBeLessThan(
      passwordEntropyBits({ length: 16 }),
    );
  });

  it('computes passphrase entropy from the wordlist size', () => {
    const wordlist = new Array(7776).fill('x');
    const bits = passphraseEntropyBits({ words: 6, includeNumber: false, wordlist });
    expect(bits).toBe(Math.round(6 * Math.log2(7776)));
  });
});
