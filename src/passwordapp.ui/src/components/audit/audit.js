import PasswordService from '@/components/api/Password.Service.js';
import { findReusedPasswords, countReusedAccounts } from '@/components/audit/reuse.js';
import { pwnedCount } from '@/components/audit/hibp.js';

// Live range-API call. Native fetch (not Axios) so the request goes straight to
// HaveIBeenPwned and is NOT prefixed with our API baseURL. `Add-Padding` asks
// HIBP to pad the response so its size can't hint at the prefix's hit count.
async function fetchRange(prefix) {
  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { 'Add-Padding': 'true' },
  });
  if (!res.ok) {
    throw new Error(`HaveIBeenPwned returned ${res.status}`);
  }
  return res.text();
}

export default {
  name: 'SecurityAudit',
  data() {
    return {
      // Reused-password report
      loading: false,
      hasRun: false,
      error: '',
      groups: [],
      reusedFirst: 0,
      reusedRows: 5,
      totalAccounts: 0,
      reusedAccounts: 0,
      failedCount: 0,
      // Breach check (HaveIBeenPwned)
      breachLoading: false,
      breachHasRun: false,
      breachError: '',
      breachResults: [],
      breachChecked: 0,
      breachFailedCount: 0,
    };
  },
  computed: {
    summary() {
      if (this.groups.length === 0) {
        return 'No reused passwords found. Every account has a unique password.';
      }
      return `${this.reusedAccounts} accounts share a password across ${this.groups.length} ` +
        `group${this.groups.length === 1 ? '' : 's'}. Give each its own password.`;
    },
    pagedGroups() {
      return this.groups.slice(this.reusedFirst, this.reusedFirst + this.reusedRows);
    },
    reusedRangeStart() {
      return this.groups.length === 0 ? 0 : this.reusedFirst + 1;
    },
    reusedRangeEnd() {
      return Math.min(this.reusedFirst + this.reusedRows, this.groups.length);
    },
    showReusedPaginator() {
      return this.groups.length > this.reusedRows;
    },
    breachSummary() {
      if (this.breachResults.length === 0) {
        return 'No breached passwords found. None of your passwords appeared in known breaches.';
      }
      const n = this.breachResults.length;
      return `${n} account${n === 1 ? '' : 's'} use a password found in known breaches. ` +
        `Change ${n === 1 ? 'it' : 'them'} now.`;
    },
  },
  methods: {
    // Fetch every entry's server-decrypted password. The list endpoint only
    // returns the *encrypted* password (and AES-GCM gives identical passwords
    // different ciphertext), so each entry must be fetched individually.
    async fetchDecryptedEntries() {
      const listResponse = await PasswordService.getAll();
      const accounts = Array.isArray(listResponse.data) ? listResponse.data : [];

      const results = await Promise.allSettled(
        accounts.map(a => PasswordService.get(a.id))
      );

      let failedCount = 0;
      const entries = results
        .map((result, i) => {
          if (result.status !== 'fulfilled') {
            failedCount += 1;
            return null;
          }
          const data = result.value.data || {};
          return {
            id: accounts[i].id,
            accountName: accounts[i].accountName,
            siteName: accounts[i].siteName,
            password: data.currentPassword,
          };
        })
        .filter(Boolean);

      return { entries, failedCount, total: accounts.length };
    },

    async runReport() {
      this.loading = true;
      this.error = '';
      this.groups = [];
      this.reusedFirst = 0;
      this.failedCount = 0;
      this.reusedAccounts = 0;

      try {
        const { entries, failedCount, total } = await this.fetchDecryptedEntries();
        this.totalAccounts = total;
        this.failedCount = failedCount;

        let working = entries;
        this.groups = findReusedPasswords(working);
        this.reusedAccounts = countReusedAccounts(this.groups);

        // Drop plaintext as soon as grouping is done.
        working = null;
      } catch (err) {
        this.error = 'Unable to run the report: ' + (err && err.message ? err.message : err);
      } finally {
        this.hasRun = true;
        this.loading = false;
      }
    },

    onReusedPage(event) {
      this.reusedFirst = event.first;
      this.reusedRows = event.rows;
    },
    groupKey(group, index) {
      return `${index}-${group.accounts.map(a => a.id).join('-')}`;
    },
    async runBreachCheck() {
      this.breachLoading = true;
      this.breachError = '';
      this.breachResults = [];
      this.breachFailedCount = 0;
      this.breachChecked = 0;

      try {
        const { entries, failedCount, total } = await this.fetchDecryptedEntries();
        this.breachChecked = total;
        this.breachFailedCount = failedCount;

        // Dedupe by password so we make the fewest range calls. Only the SHA-1
        // prefix of each password is ever sent (k-anonymity).
        const counts = new Map(); // password -> breach count
        for (const e of entries) {
          if (e.password && !counts.has(e.password)) counts.set(e.password, 0);
        }
        for (const pw of counts.keys()) {
          counts.set(pw, await pwnedCount(pw, fetchRange));
        }

        this.breachResults = entries
          .filter(e => e.password && counts.get(e.password) > 0)
          .map(e => ({
            id: e.id,
            accountName: e.accountName,
            siteName: e.siteName,
            count: counts.get(e.password),
          }))
          .sort((a, b) => b.count - a.count);

        // Drop plaintext.
        counts.clear();
      } catch (err) {
        this.breachError = 'Unable to check breaches: ' + (err && err.message ? err.message : err);
      } finally {
        this.breachHasRun = true;
        this.breachLoading = false;
      }
    },

    formatCount(n) {
      return Number(n).toLocaleString();
    },
    editAccount(id) {
      this.$router.push({ name: 'Update', params: { id } });
    },
  },
};
