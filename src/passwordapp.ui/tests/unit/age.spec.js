import { describe, it, expect } from 'vitest';
import { daysSince, monthsSince, isStale, ageLabel } from '../../src/components/utils/age.js';

const NOW = new Date('2026-06-24T12:00:00Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe('daysSince', () => {
  it('counts whole days', () => {
    expect(daysSince(daysAgo(10), NOW)).toBe(10);
  });
  it('returns 0 for future or same-instant dates', () => {
    expect(daysSince(new Date(NOW.getTime() + 5000), NOW)).toBe(0);
    expect(daysSince(NOW, NOW)).toBe(0);
  });
  it('returns 0 for missing/invalid input', () => {
    expect(daysSince(null, NOW)).toBe(0);
    expect(daysSince('not-a-date', NOW)).toBe(0);
    expect(daysSince(undefined, NOW)).toBe(0);
  });
  it('accepts ISO strings', () => {
    expect(daysSince('2026-06-14T12:00:00Z', NOW)).toBe(10);
  });
});

describe('monthsSince', () => {
  it('approximates months', () => {
    expect(monthsSince(daysAgo(60), NOW)).toBe(1);
    expect(monthsSince(daysAgo(400), NOW)).toBe(13);
  });
});

describe('isStale', () => {
  it('is true when older than the threshold', () => {
    expect(isStale(daysAgo(800), 24, NOW)).toBe(true); // ~26 months
  });
  it('is false when newer than the threshold', () => {
    expect(isStale(daysAgo(100), 24, NOW)).toBe(false);
  });
  it('treats threshold <= 0 as disabled', () => {
    expect(isStale(daysAgo(5000), 0, NOW)).toBe(false);
    expect(isStale(daysAgo(5000), -1, NOW)).toBe(false);
  });
  it('is false for missing dates or bad thresholds', () => {
    expect(isStale(null, 24, NOW)).toBe(false);
    expect(isStale(daysAgo(800), 'x', NOW)).toBe(false);
  });
  it('is true exactly at the threshold', () => {
    expect(isStale(daysAgo(Math.ceil(24 * (365.25 / 12))), 24, NOW)).toBe(true);
  });
});

describe('ageLabel', () => {
  it('returns today for very recent', () => {
    expect(ageLabel(daysAgo(0), NOW)).toBe('today');
  });
  it('returns days for < a month', () => {
    expect(ageLabel(daysAgo(1), NOW)).toBe('1 day');
    expect(ageLabel(daysAgo(10), NOW)).toBe('10 days');
  });
  it('returns months for < a year', () => {
    expect(ageLabel(daysAgo(90), NOW)).toBe('2 months');
  });
  it('returns years for >= a year', () => {
    expect(ageLabel(daysAgo(800), NOW)).toBe('2 years');
    expect(ageLabel(daysAgo(400), NOW)).toBe('1 year');
  });
  it('returns empty string for missing dates', () => {
    expect(ageLabel(null, NOW)).toBe('');
    expect(ageLabel('', NOW)).toBe('');
  });
});
