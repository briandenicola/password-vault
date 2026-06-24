import { describe, it, expect } from 'vitest';
import { parseTags, formatTags, collectTags, hasTag } from '../../src/components/utils/tags.js';

describe('parseTags', () => {
  it('splits, trims and drops blanks', () => {
    expect(parseTags(' bank , , email ,')).toEqual(['bank', 'email']);
  });
  it('de-duplicates case-insensitively, keeping first spelling', () => {
    expect(parseTags('Bank, bank, BANK, Email')).toEqual(['Bank', 'Email']);
  });
  it('accepts an array input', () => {
    expect(parseTags(['a', ' b ', 'a'])).toEqual(['a', 'b']);
  });
  it('returns [] for non-string / non-array input', () => {
    expect(parseTags(null)).toEqual([]);
    expect(parseTags(undefined)).toEqual([]);
    expect(parseTags(42)).toEqual([]);
  });
});

describe('formatTags', () => {
  it('joins a tag array with commas', () => {
    expect(formatTags(['bank', 'email'])).toBe('bank, email');
  });
  it('normalizes a messy array', () => {
    expect(formatTags([' bank ', 'bank', ''])).toBe('bank');
  });
});

describe('collectTags', () => {
  it('returns the sorted unique set across entries', () => {
    const entries = [
      { tags: ['Email', 'bank'] },
      { tags: ['email', 'Shopping'] },
      { tags: [] },
      {},
    ];
    expect(collectTags(entries)).toEqual(['bank', 'Email', 'Shopping']);
  });
  it('handles empty / invalid input', () => {
    expect(collectTags([])).toEqual([]);
    expect(collectTags(null)).toEqual([]);
  });
});

describe('hasTag', () => {
  it('matches case-insensitively', () => {
    expect(hasTag({ tags: ['Bank'] }, 'bank')).toBe(true);
    expect(hasTag({ tags: ['Bank'] }, 'email')).toBe(false);
  });
  it('returns true when no tag filter is supplied', () => {
    expect(hasTag({ tags: [] }, '')).toBe(true);
    expect(hasTag({ tags: [] }, null)).toBe(true);
  });
  it('returns false when the entry has no tags', () => {
    expect(hasTag({}, 'bank')).toBe(false);
  });
});
