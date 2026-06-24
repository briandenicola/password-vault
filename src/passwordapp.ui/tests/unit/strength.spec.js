import { describe, it, expect } from 'vitest';
import {
  estimatePasswordStrength,
  charPoolSize,
  COMMON_PASSWORDS,
} from '../../src/components/utils/strength.js';

describe('charPoolSize', () => {
  it('adds 26 for lowercase only', () => {
    expect(charPoolSize('abc')).toBe(26);
  });
  it('sums classes present', () => {
    expect(charPoolSize('aB3')).toBe(62); // 26 + 26 + 10
  });
  it('counts symbols and unicode', () => {
    expect(charPoolSize('a!')).toBe(26 + 33);
    expect(charPoolSize('aé')).toBe(26 + 40);
  });
});

describe('estimatePasswordStrength', () => {
  it('returns an empty result for an empty password', () => {
    const r = estimatePasswordStrength('');
    expect(r).toEqual({ bits: 0, label: '', variant: 'secondary', warning: '', percent: 0 });
  });

  it('treats non-string input as empty', () => {
    expect(estimatePasswordStrength(undefined).bits).toBe(0);
    expect(estimatePasswordStrength(null).label).toBe('');
  });

  it('rates a short lowercase password as weak', () => {
    const r = estimatePasswordStrength('abcdq');
    expect(r.variant).toBe('danger');
    expect(r.label).toBe('Weak');
  });

  it('rates a long mixed random password as excellent', () => {
    const r = estimatePasswordStrength('G7!pQ2#vLm9xZ4&wК');
    expect(r.bits).toBeGreaterThanOrEqual(80);
    expect(r.label).toBe('Excellent');
    expect(r.variant).toBe('success');
  });

  it('flags a common password as very weak regardless of length', () => {
    const r = estimatePasswordStrength('password123');
    expect(r.bits).toBe(0);
    expect(r.label).toBe('Very weak');
    expect(r.variant).toBe('danger');
    expect(r.warning).toMatch(/common|predictable/i);
  });

  it('common-password match is case-insensitive', () => {
    expect(estimatePasswordStrength('PassWord').label).toBe('Very weak');
  });

  it('flags a single repeated character', () => {
    const r = estimatePasswordStrength('aaaaaaaaaa');
    expect(r.label).toBe('Very weak');
    expect(r.warning).not.toBe('');
  });

  it('flags an ascending sequence', () => {
    expect(estimatePasswordStrength('abcdefgh').label).toBe('Very weak');
  });

  it('flags a descending numeric sequence', () => {
    expect(estimatePasswordStrength('654321').label).toBe('Very weak');
  });

  it('does not flag a normal password as sequential', () => {
    const r = estimatePasswordStrength('Tr0ub4dour&3xtra');
    expect(r.label).not.toBe('Very weak');
  });

  it('clamps percent to the 0-100 range', () => {
    const r = estimatePasswordStrength('G7!pQ2#vLm9xZ4&wYz8$bN1');
    expect(r.percent).toBeLessThanOrEqual(100);
    expect(r.percent).toBeGreaterThanOrEqual(0);
  });

  it('blocklist contains well-known weak passwords', () => {
    expect(COMMON_PASSWORDS.has('123456')).toBe(true);
    expect(COMMON_PASSWORDS.has('qwerty')).toBe(true);
  });
});
