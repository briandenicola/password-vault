import { describe, it, expect } from 'vitest';
import { sha1Hex, parsePwnedRange, pwnedCount } from '@/components/audit/hibp.js';

// Known SHA-1 hashes (uppercase) for fixed inputs.
const SHA1 = {
  password: '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8',
  abc:      'A9993E364706816ABA3E25717850C26C9CD0D89D',
  empty:    'DA39A3EE5E6B4B0D3255BFEF95601890AFD80709',
};

describe('sha1Hex', () => {
  it('hashes "password" to the known uppercase hex SHA-1', async () => {
    expect(await sha1Hex('password')).toBe(SHA1.password);
  });

  it('hashes "abc" to the known SHA-1', async () => {
    expect(await sha1Hex('abc')).toBe(SHA1.abc);
  });

  it('hashes the empty string to the known SHA-1', async () => {
    expect(await sha1Hex('')).toBe(SHA1.empty);
  });
});

describe('parsePwnedRange', () => {
  it('parses suffix:count lines into a map', () => {
    const map = parsePwnedRange('0018A45C4D1DEF81644B54AB7F969B88D65:1\nABCDEF:25');
    expect(map.get('0018A45C4D1DEF81644B54AB7F969B88D65')).toBe(1);
    expect(map.get('ABCDEF')).toBe(25);
  });

  it('tolerates CRLF, blank lines and padding rows', () => {
    const map = parsePwnedRange('\r\nABC:5\r\n\r\nDEF:0\r\n');
    expect(map.get('ABC')).toBe(5);
    expect(map.get('DEF')).toBe(0);
    expect(map.size).toBe(2);
  });

  it('uppercases suffixes for case-insensitive matching', () => {
    const map = parsePwnedRange('abc123:7');
    expect(map.get('ABC123')).toBe(7);
  });

  it('ignores malformed lines without a colon', () => {
    const map = parsePwnedRange('garbage-no-colon\nABC:3');
    expect(map.size).toBe(1);
    expect(map.get('ABC')).toBe(3);
  });
});

describe('pwnedCount', () => {
  it('sends only the 5-char prefix and returns the matching count', async () => {
    let sentPrefix = null;
    const fetchRange = (prefix) => {
      sentPrefix = prefix;
      // suffix of "password" hash -> big count
      return Promise.resolve(`${SHA1.password.slice(5)}:99999\nFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:1`);
    };
    const count = await pwnedCount('password', fetchRange);
    expect(sentPrefix).toBe('5BAA6');
    expect(sentPrefix).toHaveLength(5);
    expect(count).toBe(99999);
  });

  it('returns 0 when the suffix is not present in the range', async () => {
    const fetchRange = () => Promise.resolve('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:1');
    expect(await pwnedCount('password', fetchRange)).toBe(0);
  });

  it('returns 0 for an empty password without calling the range API', async () => {
    let called = false;
    const fetchRange = () => { called = true; return Promise.resolve(''); };
    expect(await pwnedCount('', fetchRange)).toBe(0);
    expect(called).toBe(false);
  });

  it('never passes the full hash or password to fetchRange', async () => {
    const seen = [];
    const fetchRange = (prefix) => { seen.push(prefix); return Promise.resolve(''); };
    await pwnedCount('password', fetchRange);
    expect(seen).toEqual(['5BAA6']);
    expect(seen[0]).not.toContain(SHA1.password.slice(5));
  });
});
