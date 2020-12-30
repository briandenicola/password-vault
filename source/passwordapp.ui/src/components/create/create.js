import PasswordService from '@/components/api/Password.Service.js';
import PasswordUtils from '@/components/utils/utils.js';
import Authentication from '@/components/azuread/AzureAD.Authentication.js';

export default {
  name: 'Create',
  data() {
    return {
      formData: PasswordService.newPassword(),
      alertModalTitle: '',
      alertModalContent: '',
      isSuccessfully: false,
    };
  },
  methods: {
    genPass() {
      this.formData.currentPassword = PasswordUtils.generatePassword();
    },
    onAlertModalOkClick() {
      if (this.isSuccessfully) {
        this.$router.push({ name: 'Home' });
      }
    },
    createPassword() {
      this.formData.createdBy = this.formData.lastModifiedBy = Authentication.getUserProfile(); 
      PasswordService.create(this.formData).then(() => {
        this.isSuccessfully = true;
        this.alertModalTitle = 'Successfully';
        this.alertModalContent = 'Successfully created Account / Password';
        this.$refs.alertModal.show();
        this.formData = PasswordService.newPassword();
        
      }).catch((error) => {
        this.isSuccessfully = false;
        this.alertModalTitle = 'Error';
        this.alertModalContent = "Got an error " + error.response.data;
        this.$refs.alertModal.show();
      });
    },
  },
};
