import PasswordService from '@/components/api/Password.Service.js';
import Authentication from '@/components/azuread/AzureAD.Authentication.js';
import PasswordGenerator from '@/components/generator/generator.vue';

export default {
  name: 'Create',
  components: { PasswordGenerator },
  data() {
    return {
      formData: PasswordService.newPassword(),
      alertModalTitle: '',
      alertModalContent: '',
      isSuccessfully: false,
    };
  },
  methods: {
    onGenerated(password) {
      this.formData.currentPassword = password;
    },
    onAlertModalOkClick() {
      if (this.isSuccessfully) {
        this.$router.push({ name: 'Home' });
      }
    },
    createNewAccount() {
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
