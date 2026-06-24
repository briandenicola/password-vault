import { describe, it, expect } from 'vitest';
import { findReusedPasswords, countReusedAccounts } from '../../src/components/audit/reuse.js';

describe('findReusedPasswords', () => {
  it('returns no groups when every password is unique', () => {
    const entries = [
      { id: '1', accountName: 'a', siteName: 'x', password: 'alpha' },
      { id: '2', accountName: 'b', siteName: 'y', password: 'beta' },
      { id: '3', accountName: 'c', siteName: 'z', password: 'gamma' },
    ];
    expect(findReusedPasswords(entries)).toEqual([]);
  });

  it('groups accounts that share an identical password', () => {
    const entries = [
      { id: '1', accountName: 'gmail', siteName: 'google.com', password: 'shared' },
      { id: '2', accountName: 'docs', siteName: 'google.com', password: 'shared' },
      { id: '3', accountName: 'bank', siteName: 'bank.com', password: 'unique' },
    ];
    const groups = findReusedPasswords(entries);
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(2);
    expect(groups[0].accounts.map(a => a.id).sort()).toEqual(['1', '2']);
  });

  it('never includes the password value in returned groups', () => {
    const entries = [
      { id: '1', accountName: 'a', siteName: 'x', password: 'secret' },
      { id: '2', accountName: 'b', siteName: 'y', password: 'secret' },
    ];
    const groups = findReusedPasswords(entries);
    expect(groups[0].accounts[0]).not.toHaveProperty('password');
    expect(JSON.stringify(groups)).not.toContain('secret');
  });

  it('is case-sensitive — different casing is not reuse', () => {
    const entries = [
      { id: '1', accountName: 'a', siteName: 'x', password: 'Passw0rd' },
      { id: '2', accountName: 'b', siteName: 'y', password: 'passw0rd' },
    ];
    expect(findReusedPasswords(entries)).toEqual([]);
  });

  it('ignores blank, missing, and non-string passwords', () => {
    const entries = [
      { id: '1', accountName: 'a', siteName: 'x', password: '' },
      { id: '2', accountName: 'b', siteName: 'y', password: '' },
      { id: '3', accountName: 'c', siteName: 'z' },
      { id: '4', accountName: 'd', siteName: 'w', password: null },
      { id: '5', accountName: 'e', siteName: 'v', password: 12345 },
    ];
    expect(findReusedPasswords(entries)).toEqual([]);
  });

  it('sorts the most-reused group first', () => {
    const entries = [
      { id: '1', password: 'two' },
      { id: '2', password: 'two' },
      { id: '3', password: 'three' },
      { id: '4', password: 'three' },
      { id: '5', password: 'three' },
    ];
    const groups = findReusedPasswords(entries);
    expect(groups.map(g => g.count)).toEqual([3, 2]);
  });

  it('defaults missing account/site fields to empty strings', () => {
    const entries = [
      { id: '1', password: 'dup' },
      { id: '2', password: 'dup' },
    ];
    const [group] = findReusedPasswords(entries);
    expect(group.accounts[0]).toEqual({ id: '1', accountName: '', siteName: '' });
  });

  it('handles non-array / empty input safely', () => {
    expect(findReusedPasswords(undefined)).toEqual([]);
    expect(findReusedPasswords(null)).toEqual([]);
    expect(findReusedPasswords([])).toEqual([]);
  });
});

describe('countReusedAccounts', () => {
  it('sums account counts across all groups', () => {
    const groups = [{ count: 3, accounts: [] }, { count: 2, accounts: [] }];
    expect(countReusedAccounts(groups)).toBe(5);
  });

  it('returns 0 for no groups', () => {
    expect(countReusedAccounts([])).toBe(0);
    expect(countReusedAccounts(undefined)).toBe(0);
  });
});
