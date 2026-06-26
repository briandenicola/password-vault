import PasswordService from '@/components/api/Password.Service.js';
import Moment from 'moment';
import Authentication from '@/components/azuread/AzureAD.Authentication.js';
import { loadSettings } from '@/components/settings/settings.store.js';
import { copyWithAutoClear } from '@/components/utils/clipboard.js';
import { parseTags, collectTags, hasTag } from '@/components/utils/tags.js';
import { isStale, ageLabel } from '@/components/utils/age.js';
import { useAccountsStore } from '@/stores/accounts.store.js';

const ACCOUNT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export default {
  name: 'PasswordList',
  computed: {
    isAuthenticated() {
      return Authentication.isAuthenticated();
    },
    allTags() {
      return collectTags(this.passwords);
    },
    passwords() {
      return this.accountsStore.accounts;
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
    sortedFilteredPasswords() {
      const field = this.sortBy || 'accountName';
      const direction = this.sortDesc ? -1 : 1;
      return [...this.filteredPasswords].sort((left, right) =>
        this.compareRows(left, right, field) * direction);
    },
    mobilePagedPasswords() {
      return this.sortedFilteredPasswords.slice(this.mobileFirst, this.mobileFirst + this.perPage);
    },
  },
  data() {
    const settings = loadSettings(Authentication.getUserProfile());
    return {
      accountsStore: useAccountsStore(),
      perPage:      settings.list.perPage,
      mobileFirst:  0,
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
      showClipboardRetryModal: false,
      clipboardRetryText: '',
      clipboardRetryError: '',
      apiError:           '',
      accountRefreshTimer: null,
    };
  },

  created() {
    this.fetchPasswords();
    this.accountRefreshTimer = window.setInterval(() => this.refreshPasswords(), ACCOUNT_REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  },

  beforeUnmount() {
    if (this.accountRefreshTimer) {
      window.clearInterval(this.accountRefreshTimer);
    }
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  },

  watch: {
    filter() {
      this.mobileFirst = 0;
    },
    selectedTag() {
      this.mobileFirst = 0;
    },
    filteredPasswords(list) {
      this.clampMobileFirst(list.length);
    },
    perPage() {
      this.clampMobileFirst();
    },
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
    isDetailsExpanded(row) {
      return Boolean(this.expandedRows[row.id]);
    },
    onMobilePage(event) {
      this.mobileFirst = event.first;
      this.perPage = event.rows;
    },
    clampMobileFirst(total = this.filteredPasswords.length) {
      if (total <= 0) {
        this.mobileFirst = 0;
        return;
      }

      if (this.mobileFirst >= total) {
        this.mobileFirst = Math.floor((total - 1) / this.perPage) * this.perPage;
      }
    },
    compareRows(left, right, field) {
      const leftValue = this.sortValue(left && left[field], field);
      const rightValue = this.sortValue(right && right[field], field);
      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return leftValue - rightValue;
      }
      return String(leftValue).localeCompare(String(rightValue), undefined, { sensitivity: 'base' });
    },
    sortValue(value, field) {
      if (field === 'lastModifiedDate') {
        const time = Date.parse(value);
        return Number.isFinite(time) ? time : 0;
      }
      return value ?? '';
    },
    updatePassword(passwordId) {
      this.$router.push({ name: 'Update', params: { id: passwordId } });
    },
    deletePassword(passwordId) {
      this.selectedPasswordId = passwordId;
      this.showDeleteModal = true;
    },
    fetchPasswords() {
      this.apiError = this.accountsStore.error;
      this.accountsStore.fetchAccounts()
        .then(() => {
          this.apiError = '';
        })
        .catch(() => {
          this.apiError = this.accountsStore.error;
        });
    },
    refreshPasswords() {
      this.accountsStore.refreshAccounts()
        .then(() => {
          this.apiError = '';
        })
        .catch(() => {
          this.apiError = this.accountsStore.error;
        });
    },
    onVisibilityChange() {
      if (document.visibilityState === 'visible' && this.accountsStore.isStale) {
        this.refreshPasswords();
      }
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
    showCopyToast() {
      const message = this.copySuccessMessage();
      this.showSuccessToast('Copied', message);
    },
    showSuccessToast(summary, detail) {
      if (this.$toast && typeof this.$toast.add === 'function') {
        this.$toast.add({
          severity: 'success',
          summary,
          detail,
          life: 3500,
        });
        return;
      }
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
      this.writeSecretToClipboard(text);
    },
    writeSecretToClipboard(text) {
      return copyWithAutoClear(text, this.clipboardClearSeconds)
        .then(() => {
          this.showCopyToast();
        })
        .catch(err => {
          this.requestClipboardRetry(text, err);
        });
    },
    copyPassword(passwordId) {
      PasswordService.get(passwordId)
        .then(response => this.writeSecretToClipboard(response.data.currentPassword))
        .catch(err => {
          this.requestClipboardRetry('', err);
        });
    },
    requestClipboardRetry(text, error) {
      this.clipboardRetryText = text || '';
      this.clipboardRetryError = error ? String(error) : '';
      this.showClipboardRetryModal = Boolean(text);
      if (!text) {
        this.showAlert('Error. . .', "Copy failed with error: " + error);
      }
    },
    retryClipboardCopy() {
      const text = this.clipboardRetryText;
      this.clipboardRetryError = '';
      copyWithAutoClear(text, this.clipboardClearSeconds)
        .then(() => {
          this.showClipboardRetryModal = false;
          this.clipboardRetryText = '';
          this.showCopyToast();
        })
        .catch(err => {
          this.clipboardRetryError = String(err);
        });
    },
    cancelClipboardRetry() {
      this.showClipboardRetryModal = false;
      this.clipboardRetryText = '';
      this.clipboardRetryError = '';
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
      this.accountsStore.deleteAccount(this.selectedPasswordId)
      .then(() => {
        this.showSuccessToast('Account deleted', 'The account was moved to the recycle bin.');
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
