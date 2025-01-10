import PasswordService from '@/components/api/Password.Service.js';
import Moment from 'moment';
import Authentication from '@/components/azuread/AzureAD.Authentication.js';

export default {
  name: 'PasswordList',
  filters: {
    formatDate: function(value) {
      if (value) {
        return Moment(String(value)).format('MM/DD/YYYY hh:mm:ss A')
      }
    }
  },
  computed: {
    isAuthenticated() {
      return Authentication.isAuthenticated();
    }
  },
  data() {
    return {
      passwords: [],
      currentPage: 1,
      perPage: 10,
      totalRows: 0,
      filter: null,
      sortBy: "siteName",
      sortDesc: false,
      fields: [ 
        { key: 'accountName', label: 'Account', sortable: true},
        { key: 'siteName', label: 'Site', sortable: true}, 
        { key: 'lastModifiedDate', label: 'Last Modified', sortable: false},
        { key: 'edit', label: 'Edit/Remove' }
      ],
      selectedPasswordId: null,
      alertModalTitle: '',
      alertModalContent: '',
    };
  },

  created() {
    this.fetchPasswords(Authentication.getBearerToken());
  },

  methods: {
    logOut() {
      Authentication.signOut();
    },
    onFiltered (filteredItems) {
      this.totalRows = filteredItems.length;
      this.currentPage = 1;
    },
    showPassword(passwordId) {
      this.$router.push({ name: 'Details', params: { id: passwordId } });
    },
    updatePassword(passwordId) {
      this.$router.push({ name: 'Update', params: { id: passwordId } });
    },
    deletePassword(passwordId) {
      this.selectedPasswordId = passwordId;
      this.$refs.deleteConfirmModal.show();
    },
    fetchPasswords() {
      PasswordService.getAll().then((response) => {
        this.passwords = response.data;
        this.totalRows = response.data.length;
      });
    },
    displayPassword(passwordId) {
      PasswordService.get(passwordId).then((response) => {
        this.alertModalTitle = 'Success. . .';
        this.alertModalContent = response.data.currentPassword;
        this.$refs.alertModal.show();
      });
    },
    copyPassword(passwordId) {
      try {
        const text = new ClipboardItem({
          "text/plain": PasswordService.get(passwordId)
            .then(response => response.data.currentPassword)
            .then(text => new Blob([text], { type: "text/plain" }))
        })
        navigator.clipboard.write([text])
        
        this.alertModalTitle = 'Success. . .';
        this.alertModalContent = 'Password Copied to Clipboard';
        this.$refs.alertModal.show();
      } 
      catch(err)  {
        this.alertModalTitle = 'Error. . .';
        this.alertModalContent = "Copy failed with error: " + err;
        this.$refs.alertModal.show();
      };
    },
    onDeleteConfirm() {
      PasswordService.delete(this.selectedPasswordId).then(() => {
        this.alertModalTitle = 'Successfully';
        this.alertModalContent = 'Successfully deleted Account';
        this.$refs.alertModal.show();
        this.fetchPasswords();
      }).catch((error) => {
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
