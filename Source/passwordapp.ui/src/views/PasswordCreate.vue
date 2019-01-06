<template>
  <b-container fluid>
    <div class="form-wrapper">
      <b-form @submit.prevent="createPassword">
        <b-form-group 
          :label-cols="2" 
          breakpoint="md" 
          horizontal 
          label="Account Name:"
          for="accountName">
          <b-col sm="auto">
            <b-input 
              id="accountName" 
              v-model="formData.accountName" 
              maxlength="60" 
              required />
          </b-col>
        </b-form-group>
 
        <b-form-group
          :label-cols="2"
          breakpoint="md"
          horizontal
          label="Site Name:"
          for="siteName">
          <b-col sm="auto">
            <b-input
              id="siteName"
              v-model="formData.siteName"
              maxlength="100"
              required />
          </b-col>
        </b-form-group>
 
        <b-form-group
          :label-cols="2"
          breakpoint="md"
          horizontal
          label="Password:"
          for="currentPassword">
          <b-col sm="auto">
            <b-input
              id="currentPassword"
              v-model="formData.currentPassword"
              maxlength="100"
              required />
          </b-col>
        </b-form-group>
 
        <b-form-group
          :label-cols="2"
          breakpoint="md"
          horizontal
          label="Security Question #1:"
          for="securityQuestion1">
          <b-col sm="auto">
            <b-input
              id="securityQuestion1"
              v-model="formData.securityQuestions[0].question"
              maxlength="100" />
          </b-col>
        </b-form-group>

        <b-form-group
          :label-cols="2"
          breakpoint="md"
          horizontal
          label="Security Answer #1:"
          for="securityAnswer1">
          <b-col sm="auto">
            <b-input
              id="securityAnswer1"
              v-model="formData.securityQuestions[0].answer"
              maxlength="100" />
          </b-col>
        </b-form-group>

        <b-form-group
          :label-cols="2"
          breakpoint="md"
          horizontal
          label="Security Question #2:"
          for="securityQuestion2">
          <b-col sm="auto">
            <b-input
              id="securityQuestion2"
              v-model="formData.securityQuestions[1].question"
              maxlength="100" />
          </b-col>
        </b-form-group>

        <b-form-group
          :label-cols="2"
          breakpoint="md"
          horizontal
          label="Security Answer #2:"
          for="securityAnswer2">
          <b-col sm="auto">
            <b-input
              id="securityAnswer2"
              v-model="formData.securityQuestions[1].answer"
              maxlength="100"/>
          </b-col>
        </b-form-group>

        <b-form-group
          :label-cols="2"
          breakpoint="md"
          horizontal
          label="Security Question #3:"
          for="securityQuestion3">
          <b-col sm="auto">
            <b-input
              id="securityQuestion3"
              v-model="formData.securityQuestions[2].question"
              maxlength="100" />
          </b-col>
        </b-form-group>

        <b-form-group
          :label-cols="2"
          breakpoint="md"
          horizontal
          label="Security Answer #3:"
          for="securityAnswer3">
          <b-col sm="auto">
            <b-input
              id="securityAnswer3"
              v-model="formData.securityQuestions[2].answer"
              maxlength="100" />
          </b-col>
        </b-form-group>
        
        <b-form-group
          :label-cols="2"
          breakpoint="md"
          horizontal
          label="Notes:"
          for="notes">
          <b-col sm="auto">
            <b-form-textarea
              id="notes"
              v-model="formData.notes"
              maxlength="100"
              :rows="3"
              :max-rows="6" />
          </b-col>
        </b-form-group>

        <b-form-group
          :label-cols="2"
          breakpoint="md"
          horizontal
          label="Created By:"
          for="createdBy">
          <b-col sm="auto">
            <b-input
              id="createdBy"
              v-model="formData.createdBy"
              maxlength="100"
              readonly
              :rows="3"
              :max-rows="6" />
          </b-col>
        </b-form-group>

        <b-form-group
          :label-cols="2"
          breakpoint="md"
          horizontal
          label="Last Updated By:"
          for="updatedBy">
          <b-col sm="auto">
            <b-input
              id="updatedBy"
              v-model="formData.lastModifiedBy"
              maxlength="100"
              readonly/>
          </b-col>
        </b-form-group>
            
        <b-row>
          <b-col sm="auto" align-h="end">
            <b-button size="sm" variant="success" @click.stop="generatePassword()">Generate Password</b-button> |
            <b-button size="sm" type="submit" variant="info">Save</b-button> |
            <b-button size="sm" :to="{ name: 'Home' }" variant="danger">Cancel</b-button>
          </b-col>
        </b-row>
      </b-form>
    </div>

    <b-modal
      ref="alertModal"
      :title="alertModalTitle"
      :ok-only="true"
      @ok="onAlertModalOkClick">
      <p class="my-4">{{ alertModalContent }}</p>
    </b-modal> 
  </b-container>
</template>

<script>
import PasswordService from '@/components/Password.Service';
import Authentication from '../components/AzureAD.Authentication.js';

export default {
  name: 'Create',
  data() {
    return {
      formData: {
        accountName: '',
        siteName: '',
        createdBy: Authentication.getUserProfile().email,
        lastModifiedBy:  Authentication.getUserProfile().email,
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
</script>

<style>
.form-wrapper {
  margin-top: 20px;
  min-height: 20px;
  padding: 19px;
  margin-bottom: 20px;
  background-color: #f5f5f5;
  border: 1px solid #e3e3e3;
  border-radius: 4px;
  box-shadow: inset 0 1px 1px rgba(0,0,0,.05);
}
</style>