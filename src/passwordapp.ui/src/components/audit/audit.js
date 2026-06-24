import PasswordService from '@/components/api/Password.Service.js';
import { findReusedPasswords, countReusedAccounts } from '@/components/audit/reuse.js';

export default {
  name: 'SecurityAudit',
  data() {
    return {
      loading: false,
      hasRun: false,
      error: '',
      groups: [],
      totalAccounts: 0,
      reusedAccounts: 0,
      failedCount: 0,
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
  },
  methods: {
    async runReport() {
      this.loading = true;
      this.error = '';
      this.groups = [];
      this.failedCount = 0;
      this.reusedAccounts = 0;

      try {
        const listResponse = await PasswordService.getAll();
        const accounts = Array.isArray(listResponse.data) ? listResponse.data : [];
        this.totalAccounts = accounts.length;

        // The list endpoint only returns the *encrypted* password (and, with
        // AES-GCM, identical passwords yield different ciphertext), so we must
        // fetch each entry to get the server-decrypted plaintext.
        const results = await Promise.allSettled(
          accounts.map(a => PasswordService.get(a.id))
        );

        let entries = results
          .map((result, i) => {
            if (result.status !== 'fulfilled') {
              this.failedCount += 1;
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

        this.groups = findReusedPasswords(entries);
        this.reusedAccounts = countReusedAccounts(this.groups);

        // Drop plaintext as soon as grouping is done — keep secrets out of memory.
        entries = null;
      } catch (err) {
        this.error = 'Unable to run the report: ' + (err && err.message ? err.message : err);
      } finally {
        this.hasRun = true;
        this.loading = false;
      }
    },
    editAccount(id) {
      this.$router.push({ name: 'Update', params: { id } });
    },
  },
};
