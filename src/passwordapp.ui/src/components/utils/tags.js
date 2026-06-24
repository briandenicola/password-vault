// FE-2 — Tag parsing/formatting helpers.
//
// Pure and dependency-free. Tags are entered as a comma-separated string in the
// forms and stored as an array on the entry. Parsing trims, drops blanks, and
// de-duplicates case-insensitively (keeping the first spelling seen).

/**
 * Parse a comma-separated string (or an array) into a clean tag array.
 * @param {string|string[]} input
 * @returns {string[]}
 */
export function parseTags(input) {
  let parts;
  if (Array.isArray(input)) {
    parts = input;
  } else if (typeof input === 'string') {
    parts = input.split(',');
  } else {
    return [];
  }

  const seen = new Set();
  const tags = [];
  for (const part of parts) {
    if (typeof part !== 'string') continue;
    const tag = part.trim();
    if (tag === '') continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

/**
 * Format a tag array back into a comma-separated string for an input field.
 * @param {string[]} tags
 * @returns {string}
 */
export function formatTags(tags) {
  return parseTags(tags).join(', ');
}

/**
 * Collect the unique set of tags used across many entries, sorted
 * alphabetically (case-insensitive).
 * @param {Array<{tags?: string[]}>} entries
 * @returns {string[]}
 */
export function collectTags(entries) {
  const seen = new Map(); // lowercase -> original spelling
  for (const entry of Array.isArray(entries) ? entries : []) {
    for (const tag of parseTags(entry && entry.tags)) {
      const key = tag.toLowerCase();
      if (!seen.has(key)) seen.set(key, tag);
    }
  }
  return [...seen.values()].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()));
}

/**
 * True if `entry` carries `tag` (case-insensitive).
 * @param {{tags?: string[]}} entry
 * @param {string} tag
 * @returns {boolean}
 */
export function hasTag(entry, tag) {
  if (!tag) return true;
  const target = String(tag).toLowerCase();
  return parseTags(entry && entry.tags).some(t => t.toLowerCase() === target);
}
