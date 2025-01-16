import PasswordService from '@/components/api/Password.Service.js';
import Authentication from '@/components/azuread/AzureAD.Authentication.js';
import PasswordUtils from '@/components/utils/utils.js';

export default {
  name: 'Update',
  data() {
    return {
      formData:           PasswordService.newPassword(),
      id:                 '',
      alertModalTitle:    '',
      alertModalContent:  '',
      isSuccessfully:     false,
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
    genPass() {
      this.formData.currentPassword = PasswordUtils.generatePassword();
    },
    updatePassword() {
      this.formData.lastModifiedBy = Authentication.getUserProfile();
      PasswordService.update(this.id, this.formData)
      .then(() => {
        this.isSuccessfully = true;
        this.alertModalTitle = 'Successfully';
        this.alertModalContent = 'Successfully updated Account';
        this.$refs.alertModal.show();
      })
      .catch((error) => {
        this.isSuccessfully = false;
        this.alertModalTitle = 'Error';
        this.alertModalContent = error.response.data;
        this.$refs.alertModal.show();
      });
    },
    onAlertModalOkClick() {
      if (this.isSuccessfully) {
        this.$router.push({ name: 'Home' });
      }
    },
  },
};