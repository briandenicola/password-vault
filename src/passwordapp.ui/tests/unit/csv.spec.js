import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  toCsv,
  entriesToCsv,
  csvToEntries,
  EXPORT_HEADER,
} from '@/components/transfer/csv.js';

describe('parseCsv', () => {
  it('parses a simple grid', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('handles quoted fields with commas', () => {
    expect(parseCsv('name,notes\ngmail,"hello, world"')).toEqual([
      ['name', 'notes'],
      ['gmail', 'hello, world'],
    ]);
  });

  it('handles escaped quotes and newlines inside quotes', () => {
    const rows = parseCsv('a\n"line1\nline2","say ""hi"""');
    expect(rows).toEqual([['a'], ['line1\nline2', 'say "hi"']]);
  });

  it('treats CRLF as a row separator', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('drops only the trailing empty row from a final newline', () => {
    expect(parseCsv('a\n1\n')).toEqual([['a'], ['1']]);
  });
});

describe('toCsv', () => {
  it('quotes fields containing commas, quotes or newlines', () => {
    const csv = toCsv([['name', 'notes'], ['gmail', 'a,b'], ['x', 'has "q"'], ['y', 'two\nlines']]);
    expect(csv).toBe('name,notes\r\ngmail,"a,b"\r\nx,"has ""q"""\r\ny,"two\nlines"');
  });

  it('round-trips through parseCsv', () => {
    const rows = [['name', 'url'], ['a,b', 'http://x'], ['"weird"', 'line\nbreak']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe('entriesToCsv', () => {
  it('writes the neutral header and maps fields', () => {
    const csv = entriesToCsv([
      { accountName: 'gmail', siteName: 'mail.google.com', password: 'p@ss,1', notes: 'fam', tags: ['email', 'google'] },
    ]);
    const rows = parseCsv(csv);
    expect(rows[0]).toEqual(EXPORT_HEADER);
    expect(rows[1]).toEqual(['gmail', 'mail.google.com', 'gmail', 'p@ss,1', 'fam', 'email, google']);
  });

  it('tolerates missing/empty fields', () => {
    const rows = parseCsv(entriesToCsv([{ accountName: 'x', siteName: 'y', password: 'z' }]));
    expect(rows[1]).toEqual(['x', 'y', 'x', 'z', '', '']);
  });
});

describe('csvToEntries', () => {
  it('imports our own export format', () => {
    const csv = entriesToCsv([
      { accountName: 'gmail', siteName: 'mail.google.com', password: 'secret', notes: 'n', tags: ['a', 'b'] },
    ]);
    const { entries, skipped } = csvToEntries(csv);
    expect(skipped).toBe(0);
    expect(entries).toEqual([
      { accountName: 'gmail', siteName: 'mail.google.com', password: 'secret', notes: 'n', tags: ['a', 'b'] },
    ]);
  });

  it('maps Bitwarden-style headers (login_username/login_password/login_uri/folder)', () => {
    const csv = [
      'folder,favorite,type,name,notes,fields,login_uri,login_username,login_password',
      'Social,,login,Twitter,my note,,https://twitter.com,brian,hunter2',
    ].join('\n');
    const { entries } = csvToEntries(csv);
    expect(entries[0]).toEqual({
      accountName: 'brian',
      siteName: 'https://twitter.com',
      password: 'hunter2',
      notes: 'my note',
      tags: ['Social'],
    });
  });

  it('maps Chrome-style headers (name/url/username/password/note)', () => {
    const csv = 'name,url,username,password,note\nGitHub,https://github.com,octocat,gh-pass,';
    const { entries } = csvToEntries(csv);
    expect(entries[0]).toEqual({
      accountName: 'octocat',
      siteName: 'https://github.com',
      password: 'gh-pass',
      notes: '',
      tags: [],
    });
  });

  it('skips rows missing a required field and reports the count', () => {
    const csv = [
      'username,url,password',
      'has-all,site.com,pw',
      ',no-user.com,pw',
      'no-pass,site.com,',
    ].join('\n');
    const { entries, skipped } = csvToEntries(csv);
    expect(entries).toHaveLength(1);
    expect(entries[0].accountName).toBe('has-all');
    expect(skipped).toBe(2);
  });

  it('returns nothing for empty input or header-only files', () => {
    expect(csvToEntries('')).toEqual({ entries: [], skipped: 0 });
    expect(csvToEntries('username,url,password')).toEqual({ entries: [], skipped: 0 });
  });

  it('ignores blank lines between rows', () => {
    const csv = 'username,url,password\na,s.com,p\n\nb,s.com,p\n';
    const { entries, skipped } = csvToEntries(csv);
    expect(entries).toHaveLength(2);
    expect(skipped).toBe(0);
  });
});
