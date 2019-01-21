import PasswordService from '@/components/api/Password.Service.js';
import Authentication from '@/components/azuread/AzureAD.Authentication.js';

export default {
  name: 'Update',
  data() {
    return {
      formData: {
        id: '',
        partitionKey: '',
        oldPasswords: [],
        accountName: '',
        lastModifiedBy: '',
        siteName: '',
        currentPassword: '',
        notes: '',
        createdBy: '',
        createdDate: '',
        securityQuestions: [
          {
            question: '',
            answer: '',
          },
          {
            question: '',
            answer: '',
          },
          {
            question: '',
            answer: '',
          },
        ],
      },
      alertModalTitle: '',
      alertModalContent: '',
      isSuccessfully: false,
    };
  },
  created() {
    PasswordService.get(this.$router.currentRoute.params.id).then((response) => {
      this.formData = response.data;
    });
  },
  methods: {
    generatePassword() {
      var pwdChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%^&(){}[]<>,./!";
      var pwdLen = 4;
      this.formData.currentPassword = Math.random().toString(36).substr(2,8) + Array(pwdLen).fill(pwdChars).map(function(x) { return x[Math.floor(Math.random() * x.length)] }).join('');
    },
    updatePassword() {
      this.formData.lastModifiedBy = Authentication.getUserProfile().upn;
      PasswordService.update(this.$router.currentRoute.params.id, this.formData).then(() => {
        this.isSuccessfully = true;
        this.alertModalTitle = 'Successfully';
        this.alertModalContent = 'Successfully updated Account';
        this.$refs.alertModal.show();
      }).catch((error) => {
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