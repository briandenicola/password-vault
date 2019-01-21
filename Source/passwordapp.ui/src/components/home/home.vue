<template>
 <div>
    <h1 class="homeText">Password Vault</h1>
    <br/>
    <b-row class="navbar navbar-default">
      <b-col class="col-sm-3 col-md-3 pull-left">
        <div class="table-responsive">
          <router-link :to="{ name: 'Create' }">Create</router-link> |
          <a href="#" v-on:click.stop="logOut()">Log Out</a>
        </div>
      </b-col>
      <b-col class="col-sm-4 col-md-4 pull-right">
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
                @click.stop="copyPassword(data.item.id)"><font-awesome-icon icon="key" ></font-awesome-icon></b-button> |
            <b-button 
              size="sm"
              variant="primary"
              @click.stop="data.toggleDetails"><font-awesome-icon icon="info" ></font-awesome-icon></b-button> |
            <b-button
              size="sm"
              variant="success"
              @click.stop="updatePassword(data.item.id)"><font-awesome-icon icon="user-edit" ></font-awesome-icon></b-button> |
            <b-button
              size="sm"
              variant="danger"
              @click.stop="deletePassword(data.item.id)"><font-awesome-icon icon="trash-alt" ></font-awesome-icon></b-button>
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
<style src="./home.css" />
<script src="./home.js"></script>