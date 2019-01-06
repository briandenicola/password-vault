<template>
 <div>
    <h1 class="homeText">Password Vault</h1>
    <b-row class="navbar navbar-default">
      <b-col class="col-sm-3 col-md-3 pull-left">
        <div class="table-responsive">
          <router-link :to="{ name: 'Home' }">Home</router-link> | 
          <router-link :to="{ name: 'Create' }">Create</router-link> |
          <a href="#" v-on:click.stop="logOut()">Log out</a>
        </div>
      </b-col>
      <b-col class="col-sm-3 col-md-3 pull-right">
        <b-form-group horizontal class="mb-0">
          <b-input-group>
            <b-form-input v-model="filter" placeholder="Type to Search" />
            <b-input-group-append>
              <b-btn :disabled="!filter" @click="filter = ''">Clear</b-btn>
            </b-input-group-append>
          </b-input-group>
        </b-form-group>
      </b-col>
    </b-row>
    <br>
    <b-row>
      <b-col md="12">
        <b-table
          :sort-by.sync="sortBy"
          :sort-desc.sync="sortDesc"
          centered
          striped
          hover
          bordered
          small
          :current-page="currentPage"
          :per-page="perPage"
          :filter="filter"
          @filtered="onFiltered"
          :items="passwords"
          :fields="fields">
          <template slot="lastModifiedDate" slot-scope="data">
            {{data.item.lastModifiedDate | formatDate}}
          </template>
          <template slot="edit" slot-scope="data">
              <b-button size="sm" 
                variant="secondary"
                @click.stop="copyPassword(data.item.id)">Get Password</b-button> |
            <b-button 
              size="sm"
              variant="primary"
              @click.stop="data.toggleDetails">{{ data.detailsShowing ? 'Hide' : 'Show'}} Details</b-button> |
            <b-button
              size="sm"
              variant="success"
              @click.stop="updatePassword(data.item.id)">Update</b-button> |
            <b-button
              size="sm"
              variant="danger"
              @click.stop="deletePassword(data.item.id)">Delete</b-button>
          </template>
          <template slot="row-details" slot-scope="row">
            <b-card>
              <b-row class="mb-2">
                <b-col sm="3" class="text-sm-right"><b>Created By:</b></b-col>
                <b-col>{{ row.item.createdBy }}</b-col>
              </b-row>
              <b-row class="mb-2">
                <b-col sm="3" class="text-sm-right"><b>Updated By:</b></b-col>
                <b-col>{{ row.item.lastModifiedBy }}</b-col>
              </b-row>
              <b-row class="mb-2">
                <b-col sm="3" class="text-sm-right"><b>Security Questions:</b></b-col>
              </b-row>
              <b-row v-for="securityQuestion in row.item.securityQuestions" :key="securityQuestion" >
                <b-col sm="3" class="text-sm-right"><i>{{securityQuestion.question}}:</i></b-col>
                <b-col>{{securityQuestion.answer}}</b-col>
              </b-row>
              <b-row class="mb-2">
                <b-col sm="3" class="text-sm-right"><b>Notes:</b></b-col>
                <b-col>{{ row.item.notes }}</b-col>
              </b-row>
              <b-button size="sm" @click="row.toggleDetails">Hide Details</b-button>
            </b-card>
          </template>
        </b-table>
      </b-col>  
    </b-row>

    <b-row>
      <b-col md="6" class="my-1">
        <b-pagination :total-rows="totalRows" :per-page="perPage" v-model="currentPage" class="my-0" />
      </b-col>
    </b-row>

    <b-modal
      ref="deleteConfirmModal"
      title="Confirm your action"
      @ok="onDeleteConfirm"
      @hide="onDeleteModalHide">
      <p class="my-4">Are you sure you want to delete this account?</p>
    </b-modal>
 
    <b-modal
      ref="alertModal"
      :title="alertModalTitle"
      :ok-only="true">
      <p class="my-4">{{ alertModalContent }}</p>
    </b-modal>

  </div>
</template>

<script>
import PasswordService from '@/components/Password.Service';
import Moment from 'moment';
import Authentication from '../components/AzureAD.Authentication.js';

export default {
  name: 'PasswordList',
  filters: {
    formatDate: function(value) {
      if (value) {
        return Moment(String(value)).format('MM/DD/YYYY hh:mm:ss A')
      }
    }
  },
  computed: {
    isAuthenticated() {
      return Authentication.isAuthenticated();
    }
  },
  data() {
    return {
      passwords: [],
      currentPage: 1,
      perPage: 15,
      totalRows: 0,
      filter: null,
      sortBy: "siteName",
      sortDesc: false,
      fields: [ 
        { key: 'accountName', sortable: true},
        { key: 'siteName', sortable: true}, 
        { key: 'lastModifiedDate', sortable: false},
        { key: 'edit', label: 'Edit/Remove' }
      ],
      selectedPasswordId: null,
      alertModalTitle: '',
      alertModalContent: '',
    };
  },

  created() {
    this.fetchPasswords();
    this.totalRows = this.passwords.length;
  },

  methods: {
    logOut() {
      Authentication.signOut();
    },
    onFiltered (filteredItems) {
      this.totalRows = filteredItems.length
      this.currentPage = 1
    },
    showPassword(passwordId) {
      this.$router.push({ name: 'Details', params: { id: passwordId } });
    },
    updatePassword(passwordId) {
      this.$router.push({ name: 'Update', params: { id: passwordId } });
    },
    deletePassword(passwordId) {
      this.selectedPasswordId = passwordId;
      this.$refs.deleteConfirmModal.show();
    },
    fetchPasswords() {
      PasswordService.getAll().then((response) => {
        this.passwords = response.data;
      });
    },
    copyPassword(passwordId) {
      PasswordService.get(passwordId).then((response) => {
        if(navigator.clipboard) {
          navigator.clipboard.writeText(response.data.currentPassword).then(() => {
            this.alertModalTitle = 'Success. . .';
            this.alertModalContent = 'Password Copied to Clipboard';
            this.$refs.alertModal.show();
          })
          .catch(err => {
            console.error('Could not copy text: ', err);
            this.alertModalTitle = 'Success. . .';
            this.alertModalContent = response.data.currentPassword;
            this.$refs.alertModal.show();
          });
        } 
        else {
          this.alertModalTitle = 'Success. . .';
          this.alertModalContent = response.data.currentPassword;
          this.$refs.alertModal.show();
        }
      });
    },
    onDeleteConfirm() {
      PasswordService.delete(this.selectedPasswordId).then(() => {
        this.alertModalTitle = 'Successfully';
        this.alertModalContent = 'Successfully deleted Account';
        this.$refs.alertModal.show();
        this.fetchPasswords();
      }).catch((error) => {
        this.alertModalTitle = 'Error';
        this.alertModalContent = error.response.data;
        this.$refs.alertModal.show();
      });
    },
    onDeleteModalHide() {
      this.selectedPasswordId = null;
    },
  },
};
</script>

<style scoped>
.homeText{
    font-size: 35px;
    color: black;
    text-align: center;
    position: relative;
    top:30px;
    text-shadow: 2px 2px 2px gray;
}
</style>