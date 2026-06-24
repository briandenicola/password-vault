import PasswordService from '@/components/api/Password.Service.js';
import Authentication from '@/components/azuread/AzureAD.Authentication.js';
import { entriesToCsv, csvToEntries } from '@/components/transfer/csv.js';

export default {
  name: 'ImportExport',
  data() {
    return {
      // Export
      exporting: false,
      exportError: '',
      exportMessage: '',
      // Import
      parsing: false,
      importing: false,
      importError: '',
      importMessage: '',
      fileName: '',
      pending: [],      // parsed entries awaiting import
      skipped: 0,
      imported: 0,
      failed: 0,
    };
  },
  computed: {
    canImport() {
      return this.pending.length > 0 && !this.importing;
    },
  },
  methods: {
    // --- Export -------------------------------------------------------------
    async exportCsv() {
      this.exporting = true;
      this.exportError = '';
      this.exportMessage = '';
      try {
        const listResponse = await PasswordService.getAll();
        const accounts = Array.isArray(listResponse.data) ? listResponse.data : [];

        // The list returns only encrypted blobs; fetch each entry for its
        // server-decrypted password.
        const results = await Promise.allSettled(accounts.map(a => PasswordService.get(a.id)));
        let entries = results
          .map((result, i) => {
            if (result.status !== 'fulfilled') return null;
            const data = result.value.data || {};
            return {
              accountName: accounts[i].accountName,
              siteName: accounts[i].siteName,
              password: data.currentPassword,
              notes: accounts[i].notes,
              tags: accounts[i].tags,
            };
          })
          .filter(Boolean);

        const csv = entriesToCsv(entries);
        entries = null; // drop plaintext from memory

        this.downloadCsv(csv);
        this.exportMessage = `Exported ${accounts.length} account${accounts.length === 1 ? '' : 's'} to CSV.`;
      } catch (err) {
        this.exportError = 'Unable to export: ' + (err && err.message ? err.message : err);
      } finally {
        this.exporting = false;
      }
    },

    downloadCsv(csv) {
      const stamp = new Date().toISOString().slice(0, 10);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `password-vault-export-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    // --- Import -------------------------------------------------------------
    onFileChange(event) {
      const file = event.target.files && event.target.files[0];
      this.resetImport();
      if (!file) return;

      this.fileName = file.name;
      this.parsing = true;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const { entries, skipped } = csvToEntries(reader.result);
          this.pending = entries;
          this.skipped = skipped;
          if (entries.length === 0) {
            this.importError = 'No importable rows found. The file needs account, site/url and password columns.';
          }
        } catch (err) {
          this.importError = 'Could not read the file: ' + (err && err.message ? err.message : err);
        } finally {
          this.parsing = false;
        }
      };
      reader.onerror = () => {
        this.parsing = false;
        this.importError = 'Could not read the file.';
      };
      reader.readAsText(file);
    },

    async importCsv() {
      this.importing = true;
      this.importError = '';
      this.importMessage = '';
      this.imported = 0;
      this.failed = 0;

      const userId = Authentication.getUserProfile();
      for (const e of this.pending) {
        const payload = {
          accountName: e.accountName,
          siteName: e.siteName,
          currentPassword: e.password,
          notes: e.notes || '',
          tags: e.tags || [],
          securityQuestions: [],
          createdBy: userId,
          lastModifiedBy: userId,
          isDeleted: false,
        };
        try {
          await PasswordService.create(payload);
          this.imported += 1;
        } catch {
          this.failed += 1;
        }
      }

      this.importMessage = `Imported ${this.imported} account${this.imported === 1 ? '' : 's'}.` +
        (this.failed ? ` ${this.failed} failed.` : '') +
        (this.skipped ? ` ${this.skipped} row${this.skipped === 1 ? '' : 's'} skipped (missing fields).` : '');
      this.pending = [];
      this.importing = false;
    },

    resetImport() {
      this.pending = [];
      this.skipped = 0;
      this.imported = 0;
      this.failed = 0;
      this.importError = '';
      this.importMessage = '';
      this.fileName = '';
    },
  },
};
