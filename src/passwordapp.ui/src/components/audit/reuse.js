// FE-4 — Reused / duplicate password detection.
//
// Pure, dependency-free grouping logic so it can be unit-tested in Node and
// reused by the audit page. Plaintext passwords are only used to *group*; the
// returned groups never carry the password value (so the report's reactive
// state can't leak secrets).

/**
 * Group decrypted entries by identical password and return only the groups
 * shared by two or more accounts.
 *
 * @param {Array<{id:string, accountName?:string, siteName?:string, password?:string}>} entries
 * @returns {Array<{count:number, accounts:Array<{id:string, accountName:string, siteName:string}>}>}
 *          Groups sorted with the most-reused first.
 */
export function findReusedPasswords(entries) {
  const byPassword = new Map();

  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry) continue;
    const password = typeof entry.password === 'string' ? entry.password : '';
    // Ignore blank / missing passwords — empty strings aren't "reuse".
    if (password === '') continue;

    if (!byPassword.has(password)) {
      byPassword.set(password, []);
    }
    byPassword.get(password).push({
      id: entry.id,
      accountName: entry.accountName || '',
      siteName: entry.siteName || '',
    });
  }

  const groups = [];
  for (const accounts of byPassword.values()) {
    if (accounts.length >= 2) {
      groups.push({ count: accounts.length, accounts });
    }
  }

  // Most-reused first; that's where the biggest blast radius is.
  groups.sort((a, b) => b.count - a.count);
  return groups;
}

/**
 * Total number of distinct accounts that share a password with at least one
 * other account.
 *
 * @param {ReturnType<typeof findReusedPasswords>} groups
 * @returns {number}
 */
export function countReusedAccounts(groups) {
  return (groups || []).reduce((sum, g) => sum + g.count, 0);
}
