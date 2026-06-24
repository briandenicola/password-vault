import PasswordService from '@/components/api/Password.Service.js';
import Authentication from '@/components/azuread/AzureAD.Authentication.js';
import PasswordGenerator from '@/components/generator/generator.vue';

export default {
  name: 'Update',
  components: { PasswordGenerator },
  data() {
    return {
      formData:           PasswordService.newPassword(),
      id:                 '',
      alertModalTitle:    '',
      alertModalContent:  '',
      isSuccessfully:     false,
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
    updatePassword() {
      this.formData.lastModifiedBy = Authentication.getUserProfile();
      PasswordService.update(this.id, this.formData)
      .then(() => {
        this.isSuccessfully = true;
        this.alertModalTitle = 'Successfully';
        this.alertModalContent = 'Successfully updated Account';
        this.showAlertModal = true;
      })
      .catch((error) => {
        this.isSuccessfully = false;
        this.alertModalTitle = 'Error';
        this.alertModalContent = error.response.data;
        this.showAlertModal = true;
      });
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
  },
};