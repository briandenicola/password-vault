import { parseTags, formatTags } from '@/components/utils/tags.js';

// Minimal RFC-4180 CSV reader/writer plus mapping to/from our account shape.
// Kept pure (no Vue, no network) so it is unit-testable.

// Parse CSV text into an array of row arrays. Handles quoted fields, escaped
// quotes (""), and commas / CR / LF inside quotes.
export function parseCsv(text) {
  const s = String(text);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  row.push(field);
  rows.push(row);

  // Drop a single trailing empty row produced by a final newline.
  if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }
  return rows;
}

function escapeField(value) {
  const s = value == null ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Serialize an array of row arrays into RFC-4180 CSV text (CRLF line endings).
export function toCsv(rows) {
  return rows.map(r => r.map(escapeField).join(',')).join('\r\n');
}

// Neutral header that browsers and most password managers can re-import.
export const EXPORT_HEADER = ['name', 'url', 'username', 'password', 'notes', 'tags'];

// Map decrypted vault entries -> CSV text.
export function entriesToCsv(entries) {
  const rows = [EXPORT_HEADER.slice()];
  for (const e of entries || []) {
    rows.push([
      e.accountName || '',
      e.siteName || '',
      e.accountName || '',
      e.password || '',
      e.notes || '',
      formatTags(e.tags),
    ]);
  }
  return toCsv(rows);
}

// Header synonyms for import. Order matters — earlier names win. Covers our own
// export plus Bitwarden (login_*/folder), Chrome (name/url/username/note) and
// common 1Password column names.
const FIELD_SYNONYMS = {
  accountName: ['username', 'login_username', 'user', 'login', 'email', 'account', 'name', 'title'],
  siteName: ['url', 'login_uri', 'uri', 'website', 'web site', 'site', 'urls'],
  password: ['password', 'login_password', 'pass', 'pwd'],
  notes: ['notes', 'note', 'comments', 'comment'],
  tags: ['tags', 'tag', 'folder', 'category', 'grouping'],
};

// Parse CSV text into importable entries. Returns { entries, skipped } where
// `skipped` counts data rows missing a required field (account/site/password).
export function csvToEntries(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { entries: [], skipped: 0 };

  const header = rows[0].map(h => h.trim().toLowerCase());
  const firstIndex = (names) => {
    for (const n of names) {
      const idx = header.indexOf(n);
      if (idx !== -1) return idx;
    }
    return -1;
  };
  const cols = {};
  for (const [field, syns] of Object.entries(FIELD_SYNONYMS)) cols[field] = firstIndex(syns);

  const entries = [];
  let skipped = 0;
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.length === 1 && cells[0].trim() === '') continue; // blank line
    const get = (i) => (i >= 0 && i < cells.length ? cells[i].trim() : '');

    const accountName = get(cols.accountName);
    const siteName = get(cols.siteName);
    const password = get(cols.password);
    if (!accountName || !siteName || !password) { skipped++; continue; }

    entries.push({
      accountName,
      siteName,
      password,
      notes: get(cols.notes),
      tags: parseTags(get(cols.tags)),
    });
  }
  return { entries, skipped };
}
