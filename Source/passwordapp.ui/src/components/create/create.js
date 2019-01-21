import PasswordService from '@/components/api/Password.Service.js';
import Authentication from '@/components/azuread/AzureAD.Authentication.js';

export default {
  name: 'Create',
  data() {
    return {
      formData: {
        accountName: '',
        siteName: '',
        createdBy: Authentication.getUserProfile().upn,
        lastModifiedBy:  Authentication.getUserProfile().upn,
        currentPassword: '',
        notes: '',
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

methods: {
    generatePassword() {
      var pwdChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%^&(){}[]<>,./!";
      var pwdLen = 4;
      this.formData.currentPassword = Math.random().toString(36).substr(2,8) + Array(pwdLen).fill(pwdChars).map(function(x) { return x[Math.floor(Math.random() * x.length)] }).join('');
    },
    onAlertModalOkClick() {
      if (this.isSuccessfully) {
        this.$router.push({ name: 'Home' });
      }
    },
    createPassword() {
      PasswordService.create(this.formData).then(() => {
        this.isSuccessfully = true;
        this.alertModalTitle = 'Successfully';
        this.alertModalContent = 'Successfully created Account / Password';
        this.$refs.alertModal.show();

        this.formData = {
          accountName: '',
          siteName: '',
          currentPassword: '',
          notes: '',
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
        };
      }).catch((error) => {
        this.isSuccessfully = false;
        this.alertModalTitle = 'Error';
        this.alertModalContent = "Got an error " + error.response.data;
        this.$refs.alertModal.show();
      });
    },
  },
};
