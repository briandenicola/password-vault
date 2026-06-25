import PasswordService from '@/components/api/Password.Service.js';
import Moment from 'moment';
import Authentication from '@/components/azuread/AzureAD.Authentication.js';
import { loadSettings } from '@/components/settings/settings.store.js';
import { copyWithAutoClear } from '@/components/utils/clipboard.js';
import { parseTags, collectTags, hasTag } from '@/components/utils/tags.js';
import { isStale, ageLabel } from '@/components/utils/age.js';

export default {
  name: 'PasswordList',
  computed: {
    isAuthenticated() {
      return Authentication.isAuthenticated();
    },
    allTags() {
      return collectTags(this.passwords);
    },
    tagChoices() {
      return [{ label: 'All tags', value: null }]
        .concat(this.allTags.map(t => ({ label: t, value: t })));
    },
    filteredPasswords() {
      let list = this.passwords;
      if (this.selectedTag) {
        list = list.filter(p => hasTag(p, this.selectedTag));
      }
      if (this.filter) {
        const q = this.filter.toLowerCase();
        list = list.filter(p =>
          (p.accountName || '').toLowerCase().includes(q) ||
          (p.siteName || '').toLowerCase().includes(q) ||
          (p.notes || '').toLowerCase().includes(q) ||
          parseTags(p.tags).some(t => t.toLowerCase().includes(q)));
      }
      return list;
    },
  },
  data() {
    const settings = loadSettings(Authentication.getUserProfile());
    return {
      passwords:    [],
      perPage:      settings.list.perPage,
      filter:       '',
      selectedTag:  null,
      sortBy:       settings.list.sortBy,
      sortDesc:     settings.list.sortDesc,
      staleAfterMonths: settings.list.staleAfterMonths,
      clipboardClearSeconds: settings.security.clipboardClearSeconds,
      expandedRows: {},
      selectedPasswordId: null,
      alertModalTitle:    '',
      alertModalContent:  '',
      history:            [],
      showDeleteModal:    false,
      showAlertModal:     false,
      showHistoryModal:   false,
      apiError:           '',
    };
  },

  created() {
    this.fetchPasswords();
  },

  methods: {
    tagsOf(row) {
      return parseTags(row && row.tags);
    },
    ageOf(row) {
      return ageLabel(row && row.lastModifiedDate);
    },
    staleAgeOf(row) {
      return `${this.ageOf(row).replace(/\b\w/g, c => c.toUpperCase())} Old`;
    },
    isStaleRow(row) {
      return isStale(row && row.lastModifiedDate, this.staleAfterMonths);
    },
    toggleDetails(row) {
      const expanded = { ...this.expandedRows };
      if (expanded[row.id]) {
        delete expanded[row.id];
      } else {
        expanded[row.id] = true;
      }
      this.expandedRows = expanded;
    },
    updatePassword(passwordId) {
      this.$router.push({ name: 'Update', params: { id: passwordId } });
    },
    deletePassword(passwordId) {
      this.selectedPasswordId = passwordId;
      this.showDeleteModal = true;
    },
    fetchPasswords() {
      this.apiError = '';
      PasswordService.getAll()
      .then((response) => {
        this.passwords = response.data;
      })
      .catch((error) => {
        this.passwords = [];
        this.apiError = this.describeApiError(error, 'Unable to load accounts');
      });
    },
    describeApiError(error, fallback) {
      if (error.response) {
        const detail = typeof error.response.data === 'string'
          ? error.response.data
          : error.response.data?.error || error.response.statusText;
        return `${fallback}: ${error.response.status}${detail ? ` - ${detail}` : ''}`;
      }
      if (error.request) {
        return `${fallback}: API request failed before a response was received. Check CORS, network access, and the configured API URL.`;
      }
      return `${fallback}: ${error.message || error}`;
    },
    formatDate(date) {
      if (date) {
        return Moment(String(date)).format('MM/DD/YYYY hh:mm:ss A')
      }
    },
    showAlert(title, content) {
      this.alertModalTitle = title;
      this.alertModalContent = content;
      this.showAlertModal = true;
    },
    displayPassword(passwordId) {
      PasswordService.get(passwordId)
      .then((response) => {
        this.showAlert('Success. . .', response.data.currentPassword);
      });
    },
    showHistory(passwordId) {
      PasswordService.getHistory(passwordId)
      .then((response) => {
        this.history = response.data;
        this.showHistoryModal = true;
      })
      .catch((error) => {
        this.showAlert('Error. . .', 'Unable to load password history: ' + error);
      });
    },
    copyText(text) {
      copyWithAutoClear(text, this.clipboardClearSeconds)
        .then(() => {
          this.showAlert('Success. . .', this.copySuccessMessage());
        })
        .catch(err => {
          this.showAlert('Error. . .', "Copy failed with error: " + err);
        });
    },
    copyPassword(passwordId) {
      PasswordService.get(passwordId)
        .then(response => copyWithAutoClear(response.data.currentPassword, this.clipboardClearSeconds))
        .then(() => {
          this.showAlert('Success. . .', this.copySuccessMessage());
        })
        .catch(err => {
          this.showAlert('Error. . .', "Copy failed with error: " + err);
        });
    },
    copySuccessMessage() {
      const secs = Number(this.clipboardClearSeconds);
      if (Number.isFinite(secs) && secs > 0) {
        return `Password copied to clipboard. It will be cleared in ${secs} seconds.`;
      }
      return 'Password copied to clipboard.';
    },
    onDeleteConfirm() {
      this.showDeleteModal = false;
      PasswordService.delete(this.selectedPasswordId)
      .then(() => {
        this.showAlert('Successfully', 'Successfully deleted Account');
        this.fetchPasswords();
      })
      .catch((error) => {
        this.showAlert('Error', error.response.data);
      })
      .finally(() => {
        this.selectedPasswordId = null;
      });
    },
    onDeleteCancel() {
      this.showDeleteModal = false;
      this.selectedPasswordId = null;
    },
  },
};
