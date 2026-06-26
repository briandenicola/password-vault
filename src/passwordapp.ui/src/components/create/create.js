import PasswordService from '@/components/api/Password.Service.js';
import Authentication from '@/components/azuread/AzureAD.Authentication.js';
import PasswordGenerator from '@/components/generator/generator.vue';
import PasswordStrength from '@/components/strength/strength-meter.vue';
import { parseTags, formatTags } from '@/components/utils/tags.js';
import { useAccountsStore } from '@/stores/accounts.store.js';

export default {
  name: 'Create',
  components: { PasswordGenerator, PasswordStrength },
  computed: {
    tagsInput: {
      get() {
        return formatTags(this.formData.tags);
      },
      set(value) {
        this.formData.tags = parseTags(value);
      },
    },
  },
  data() {
    return {
      formData: PasswordService.newPassword(),
      accountsStore: useAccountsStore(),
      alertModalTitle: '',
      alertModalContent: '',
      showAlertModal: false,
    };
  },
  methods: {
    onGenerated(password) {
      this.formData.currentPassword = password;
    },
    onAlertOk() {
      this.showAlertModal = false;
    },
    showSuccessToast(summary, detail) {
      if (this.$toast && typeof this.$toast.add === 'function') {
        this.$toast.add({
          severity: 'success',
          summary,
          detail,
          life: 3500,
        });
      }
    },
    createNewAccount() {
      this.formData.createdBy = this.formData.lastModifiedBy = Authentication.getUserProfile(); 
      this.accountsStore.createAccount(this.formData).then(() => {
        this.showSuccessToast('Account created', 'The account was added to the vault.');
        this.formData = PasswordService.newPassword();
        this.$router.push({ name: 'Home' });
      }).catch((error) => {
      }).catch((error) => {
        this.alertModalTitle = 'Error';
        this.alertModalContent = "Got an error " + error.response.data;
        this.showAlertModal = true;
      });
    },
  },
};
