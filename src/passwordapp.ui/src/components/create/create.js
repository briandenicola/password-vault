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
      isSuccessfully: false,
      showAlertModal: false,
    };
  },
  methods: {
    onGenerated(password) {
      this.formData.currentPassword = password;
    },
    onAlertOk() {

      this.showAlertModal = false;

      this.onAlertModalOkClick();

    },

    onAlertModalOkClick() {
      if (this.isSuccessfully) {
        this.$router.push({ name: 'Home' });
      }
    },
    createNewAccount() {
      this.formData.createdBy = this.formData.lastModifiedBy = Authentication.getUserProfile(); 
      this.accountsStore.createAccount(this.formData).then(() => {
        this.isSuccessfully = true;
        this.alertModalTitle = 'Successfully';
        this.alertModalContent = 'Successfully created Account / Password';
        this.showAlertModal = true;
        this.formData = PasswordService.newPassword();
        
      }).catch((error) => {
        this.isSuccessfully = false;
        this.alertModalTitle = 'Error';
        this.alertModalContent = "Got an error " + error.response.data;
        this.showAlertModal = true;
      });
    },
  },
};
