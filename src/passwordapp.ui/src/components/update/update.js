import PasswordService from '@/components/api/Password.Service.js';
import Authentication from '@/components/azuread/AzureAD.Authentication.js';
import PasswordGenerator from '@/components/generator/generator.vue';
import PasswordStrength from '@/components/strength/strength-meter.vue';
import { parseTags, formatTags } from '@/components/utils/tags.js';
import { useAccountsStore } from '@/stores/accounts.store.js';

export default {
  name: 'Update',
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
      formData:           PasswordService.newPassword(),
      accountsStore:      useAccountsStore(),
      id:                 '',
      alertModalTitle:    '',
      alertModalContent:  '',
      showAlertModal:     false,
    };
  },
  created() {
    this.id = this.$router.currentRoute.value.params.id;
    PasswordService.get(this.id)
    .then((response) => {
      this.formData = response.data;
    });
  },
  methods: {
    onGenerated(password) {
      this.formData.currentPassword = password;
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
    updatePassword() {
      this.formData.lastModifiedBy = Authentication.getUserProfile();
      this.accountsStore.updateAccount(this.id, this.formData)
      .then(() => {
        this.showSuccessToast('Account updated', 'The account changes were saved.');
        this.$router.push({ name: 'Home' });
      })
      .catch((error) => {
          this.alertModalTitle = 'Error';
          this.alertModalContent = error.response.data;
          this.showAlertModal = true;
      });
    },
    onAlertOk() {
      this.showAlertModal = false;
    },
  },
};