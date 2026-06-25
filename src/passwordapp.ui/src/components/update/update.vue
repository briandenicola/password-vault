<template>
  <div class="container-fluid vault-screen">
    <div class="vault-page-title">
      <h2>Edit account</h2>
      <p>Update the account details and rotate the password when needed.</p>
    </div>
    <div class="form-wrapper">
      <form @submit.prevent="updatePassword">
        <div class="row vault-form-row">
          <label class="col-2 col-form-label" for="accountName">Account Name:</label>
          <div class="col">
            <InputText id="accountName" v-model="formData.accountName" maxlength="60" required class="w-100" />
          </div>
        </div>

        <div class="row vault-form-row">
          <label class="col-2 col-form-label" for="siteName">Site Name:</label>
          <div class="col">
            <InputText id="siteName" v-model="formData.siteName" maxlength="100" required class="w-100" />
          </div>
        </div>

        <div class="row vault-form-row">
          <label class="col-2 col-form-label" for="currentPassword">Password:</label>
          <div class="col">
            <InputText id="currentPassword" v-model="formData.currentPassword" maxlength="100" required class="w-100" />
            <password-strength :password="formData.currentPassword" />
            <password-generator class="mt-2" @generated="onGenerated" />
          </div>
        </div>

        <div class="row vault-form-row">
          <label class="col-2 col-form-label" for="tags">Tags:</label>
          <div class="col">
            <InputText id="tags" v-model="tagsInput" maxlength="200" class="w-100" placeholder="comma,separated,tags" />
            <small class="text-muted">Separate tags with commas (e.g. email, finance).</small>
          </div>
        </div>

        <div class="row vault-form-row">
          <label class="col-2 col-form-label" for="securityQuestion1">Question #1:</label>
          <div class="col"><InputText id="securityQuestion1" v-model="formData.securityQuestions[0].question" maxlength="100" class="w-100" /></div>
        </div>
        <div class="row vault-form-row">
          <label class="col-2 col-form-label" for="securityAnswer1">Answer #1:</label>
          <div class="col"><InputText id="securityAnswer1" v-model="formData.securityQuestions[0].answer" maxlength="500" class="w-100" /></div>
        </div>
        <div class="row vault-form-row">
          <label class="col-2 col-form-label" for="securityQuestion2">Question #2:</label>
          <div class="col"><InputText id="securityQuestion2" v-model="formData.securityQuestions[1].question" maxlength="100" class="w-100" /></div>
        </div>
        <div class="row vault-form-row">
          <label class="col-2 col-form-label" for="securityAnswer2">Answer #2:</label>
          <div class="col"><InputText id="securityAnswer2" v-model="formData.securityQuestions[1].answer" maxlength="500" class="w-100" /></div>
        </div>
        <div class="row vault-form-row">
          <label class="col-2 col-form-label" for="securityQuestion3">Question #3:</label>
          <div class="col"><InputText id="securityQuestion3" v-model="formData.securityQuestions[2].question" maxlength="100" class="w-100" /></div>
        </div>
        <div class="row vault-form-row">
          <label class="col-2 col-form-label" for="securityAnswer3">Answer #3:</label>
          <div class="col"><InputText id="securityAnswer3" v-model="formData.securityQuestions[2].answer" maxlength="500" class="w-100" /></div>
        </div>

        <div class="row vault-form-row">
          <label class="col-2 col-form-label" for="notes">Notes:</label>
          <div class="col"><Textarea id="notes" v-model="formData.notes" maxlength="5000" :rows="5" class="w-100" /></div>
        </div>

        <div class="row vault-form-row">
          <label class="col-2 col-form-label" for="createdBy">Created By:</label>
          <div class="col"><InputText id="createdBy" v-model="formData.createdBy" maxlength="100" readonly class="w-100" /></div>
        </div>
        <div class="row mb-2">
          <label class="col-2 col-form-label" for="updatedBy">Last Updated By:</label>
          <div class="col"><InputText id="updatedBy" v-model="formData.lastModifiedBy" maxlength="100" readonly class="w-100" /></div>
        </div>

        <div class="row">
          <div class="col d-flex justify-content-end gap-2">
            <Button size="small" type="submit" severity="info" label="Save changes" />
            <Button size="small" severity="danger" label="Cancel" @click="$router.push({ name: 'Home' })" />
          </div>
        </div>
      </form>
    </div>

    <Dialog v-model:visible="showAlertModal" modal :header="alertModalTitle" :style="{ width: '30rem' }">
      <p class="my-4">{{ alertModalContent }}</p>
      <template #footer>
        <Button label="OK" @click="onAlertOk" />
      </template>
    </Dialog>
  </div>
</template>

<style src="./update.css" />
<script src="./update.js"></script>
