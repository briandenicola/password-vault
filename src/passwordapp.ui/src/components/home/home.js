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
    }
  },
  data() {
    const settings = loadSettings(Authentication.getUserProfile());
    return {
      passwords:    [],
      currentPage:  1,
      perPage:      settings.list.perPage,
      totalRows:    0,
      filter:       null,
      sortBy:       settings.list.sortBy,
      sortDesc:     settings.list.sortDesc,
      clipboardClearSeconds: settings.security.clipboardClearSeconds,
      fields: [ 
        { key: 'accountName',       label: 'Account',       sortable: true},
        { key: 'siteName',          label: 'Site',          sortable: true}, 
        { key: 'lastModifiedDate',  label: 'Last Modified', sortable: false},
        { key: 'edit',              label: 'Edit/Remove' }
      ],
      currentAccounts:    [],
      selectedPasswordId: null,
      alertModalTitle:    '',
      alertModalContent:  '',
      history:            [],
      historyFields: [
        { key: 'timeStamp', label: 'When',     sortable: false },
        { key: 'password',  label: 'Password', sortable: false },
        { key: 'copy',      label: '' },
      ],
    };
  },

  created() {
    this.fetchPasswords(Authentication.getBearerToken());
  },

  methods: {
    logOut() {
      Authentication.signOut();
    }, 
    toggleDetails(row) {
      if(row._showDetails){
        this.$set(row, '_showDetails', false)
      }else{
        this.currentAccounts.forEach(item => {
          this.$set(item, '_showDetails', false)
        })

        this.$nextTick(() => {
          this.$set(row, '_showDetails', true)
        })
      }
    },    
    onFiltered (filteredItems) {
      this.totalRows = filteredItems.length;
      this.currentPage = 1;
    },
    updatePassword(passwordId) {
      this.$router.push({ name: 'Update', params: { id: passwordId } });
    },
    deletePassword(passwordId) {
      this.selectedPasswordId = passwordId;
      this.$refs.deleteConfirmModal.show();
    },
    fetchPasswords() {
      PasswordService.getAll()
      .then((response) => {
        this.passwords = response.data;
        this.totalRows = response.data.length;
      });
    },
    formatDate(date) {      
      if (date) {
        return Moment(String(date)).format('MM/DD/YYYY hh:mm:ss A')
      } 
    },
    displayPassword(passwordId) {
      PasswordService.get(passwordId)
      .then((response) => {
        this.alertModalTitle = 'Success. . .';
        this.alertModalContent = response.data.currentPassword;
        this.$refs.alertModal.show();
      });
    },
    showHistory(passwordId) {
      PasswordService.getHistory(passwordId)
      .then((response) => {
        this.history = response.data;
        this.$refs.historyModal.show();
      })
      .catch((error) => {
        this.alertModalTitle = 'Error. . .';
        this.alertModalContent = 'Unable to load password history: ' + error;
        this.$refs.alertModal.show();
      });
    },
    copyText(text) {
      copyWithAutoClear(text, this.clipboardClearSeconds)
        .then(() => {
          this.alertModalTitle = 'Success. . .';
          this.alertModalContent = this.copySuccessMessage();
          this.$refs.alertModal.show();
        })
        .catch(err => {
          this.alertModalTitle = 'Error. . .';
          this.alertModalContent = "Copy failed with error: " + err;
          this.$refs.alertModal.show();
        });
    },
    copyPassword(passwordId) {
      PasswordService.get(passwordId)
        .then(response => copyWithAutoClear(response.data.currentPassword, this.clipboardClearSeconds))
        .then(() => {
          this.alertModalTitle = 'Success. . .';
          this.alertModalContent = this.copySuccessMessage();
          this.$refs.alertModal.show();
        })
        .catch(err => {
          this.alertModalTitle = 'Error. . .';
          this.alertModalContent = "Copy failed with error: " + err;
          this.$refs.alertModal.show();
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
      PasswordService.delete(this.selectedPasswordId)
      .then(() => {
        this.alertModalTitle = 'Successfully';
        this.alertModalContent = 'Successfully deleted Account';
        this.$refs.alertModal.show();
        this.fetchPasswords();
      })
      .catch((error) => {
        this.alertModalTitle = 'Error';
        this.alertModalContent = error.response.data;
        this.$refs.alertModal.show();
      });
    },
    onDeleteModalHide() {
      this.selectedPasswordId = null;
    },
  },
};
