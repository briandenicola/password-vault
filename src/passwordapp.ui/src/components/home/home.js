import PasswordService from '@/components/api/Password.Service.js';
import Moment from 'moment';
import Authentication from '@/components/azuread/AzureAD.Authentication.js';
import { loadSettings } from '@/components/settings/settings.store.js';
import { copyWithAutoClear } from '@/components/utils/clipboard.js';

export default {
  name: 'PasswordList',
  computed: {
    isAuthenticated() {
      return Authentication.isAuthenticated();
    },
    filteredPasswords() {
      if (!this.filter) {
        return this.passwords;
      }
      const q = this.filter.toLowerCase();
      return this.passwords.filter(p =>
        (p.accountName || '').toLowerCase().includes(q) ||
        (p.siteName || '').toLowerCase().includes(q));
    },
  },
  data() {
    const settings = loadSettings(Authentication.getUserProfile());
    return {
      passwords:    [],
      perPage:      settings.list.perPage,
      filter:       '',
      sortBy:       settings.list.sortBy,
      sortDesc:     settings.list.sortDesc,
      clipboardClearSeconds: settings.security.clipboardClearSeconds,
      expandedRows: {},
      selectedPasswordId: null,
      alertModalTitle:    '',
      alertModalContent:  '',
      history:            [],
      showDeleteModal:    false,
      showAlertModal:     false,
      showHistoryModal:   false,
    };
  },

  created() {
    this.fetchPasswords();
  },

  methods: {
    logOut() {
      Authentication.signOut();
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
      PasswordService.getAll()
      .then((response) => {
        this.passwords = response.data;
      });
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
