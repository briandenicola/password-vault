// FE-5 — Password age / expiry helpers.
//
// Pure and dependency-free so it can be unit-tested in Node. "Now" is injectable
// for deterministic tests.

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_MONTH = 365.25 / 12;
const DAYS_PER_YEAR = 365.25;

function toDate(value) {
  if (value instanceof Date) return value;
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Whole days between `date` and `now` (0 if in the future or invalid). */
export function daysSince(date, now = new Date()) {
  const d = toDate(date);
  if (!d) return 0;
  const diff = (toDate(now) ?? new Date()).getTime() - d.getTime();
  return diff <= 0 ? 0 : Math.floor(diff / MS_PER_DAY);
}

/** Approximate whole months since `date`. */
export function monthsSince(date, now = new Date()) {
  return Math.floor(daysSince(date, now) / DAYS_PER_MONTH);
}

/**
 * True when the password is at least `months` old.
 * `months <= 0` disables the check (never stale).
 */
export function isStale(date, months, now = new Date()) {
  const threshold = Number(months);
  if (!Number.isFinite(threshold) || threshold <= 0) return false;
  const d = toDate(date);
  if (!d) return false;
  return monthsSince(d, now) >= threshold;
}

/**
 * Short human-readable age, e.g. "today", "3 days", "5 months", "2 years".
 * Returns '' for missing/invalid dates.
 */
export function ageLabel(date, now = new Date()) {
  const d = toDate(date);
  if (!d) return '';
  const days = daysSince(d, now);
  if (days <= 0) return 'today';
  if (days < 31) return `${days} day${days === 1 ? '' : 's'}`;
  const years = Math.floor(days / DAYS_PER_YEAR);
  if (years >= 1) return `${years} year${years === 1 ? '' : 's'}`;
  const months = Math.max(1, monthsSince(d, now));
  return `${months} month${months === 1 ? '' : 's'}`;
}
