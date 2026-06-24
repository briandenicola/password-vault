// FE-1 — Password strength estimation for the create/update forms.
//
// Dependency-free and pure so it can be unit-tested in Node. It mirrors the
// generator's entropy model (bits from charset pool size x length, same
// Weak/Fair/Strong/Excellent thresholds) and adds a small blocklist of common
// passwords / trivial patterns so obviously weak choices are flagged regardless
// of length or character mix.

function log2(n) {
  return Math.log(n) / Math.log(2);
}

// A compact list of the most common / trivially guessable passwords. Not
// exhaustive (that's what zxcvbn is for) — just enough to catch the worst
// offenders that a pure entropy score would otherwise rate as "fair".
export const COMMON_PASSWORDS = new Set([
  '123456', '123456789', '12345678', '1234567', '1234567890', '12345', '1234',
  '111111', '000000', '121212', '123123', '654321', '666666', '112233',
  'password', 'password1', 'password123', 'passw0rd', 'qwerty', 'qwerty123',
  'qwertyuiop', 'abc123', 'abcabc', 'iloveyou', 'admin', 'admin123', 'letmein',
  'welcome', 'welcome1', 'monkey', 'dragon', 'master', 'sunshine', 'princess',
  'football', 'baseball', 'superman', 'batman', 'trustno1', 'whatever',
  'login', 'starwars', 'qazwsx', 'zaq12wsx', 'asdfgh', 'asdfghjkl', 'zxcvbnm',
  'changeme', 'secret', 'shadow', 'michael', 'ashley', 'ninja', 'hello',
  'hello123', 'pokemon', 'google', 'mustang', 'access', 'flower', 'hottie',
  'loveme', 'computer', 'summer', 'winter', 'soccer', 'cheese',
]);

/** True if the password is a single repeated character (e.g. "aaaaaa"). */
function isSingleCharRepeat(password) {
  return password.length > 0 && new Set(password).size === 1;
}

/**
 * True if the password is a short ascending or descending run of the same
 * adjacent characters (e.g. "abcdef", "654321").
 */
function isSequential(password) {
  if (password.length < 4) return false;
  let asc = true;
  let desc = true;
  for (let i = 1; i < password.length; i++) {
    const diff = password.charCodeAt(i) - password.charCodeAt(i - 1);
    if (diff !== 1) asc = false;
    if (diff !== -1) desc = false;
  }
  return asc || desc;
}

/** Size of the character pool implied by the classes present in the password. */
export function charPoolSize(password) {
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/[0-9]/.test(password)) pool += 10;
  if (/[^a-zA-Z0-9\s\x80-\uffff]/.test(password)) pool += 33; // ASCII punctuation/symbols
  if (/\s/.test(password)) pool += 1;              // whitespace
  if (/[^\x00-\x7F]/.test(password)) pool += 40;   // non-ASCII / unicode
  return pool;
}

/**
 * Estimate a password's strength.
 *
 * @param {string} password
 * @returns {{bits:number, label:string, variant:string, warning:string, percent:number}}
 */
export function estimatePasswordStrength(password) {
  const pwd = typeof password === 'string' ? password : '';

  if (pwd === '') {
    return { bits: 0, label: '', variant: 'secondary', warning: '', percent: 0 };
  }

  const lower = pwd.toLowerCase();
  const trivial =
    COMMON_PASSWORDS.has(lower) || isSingleCharRepeat(pwd) || isSequential(pwd);

  let bits;
  let warning = '';
  if (trivial) {
    // Force the lowest tier regardless of length/mix.
    bits = 0;
    warning = 'This is a very common or predictable password. Choose another.';
  } else {
    const pool = charPoolSize(pwd);
    bits = pool > 0 ? Math.round(pwd.length * log2(pool)) : 0;
  }

  let label;
  let variant;
  if (bits < 40) {
    label = trivial ? 'Very weak' : 'Weak';
    variant = 'danger';
  } else if (bits < 60) {
    label = 'Fair';
    variant = 'warn';
  } else if (bits < 80) {
    label = 'Strong';
    variant = 'info';
  } else {
    label = 'Excellent';
    variant = 'success';
  }

  // Bar fills toward the 80-bit "Excellent" mark.
  const percent = Math.max(0, Math.min(100, Math.round((bits / 80) * 100)));

  return { bits, label, variant, warning, percent };
}
