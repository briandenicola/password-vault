<template>
 <div>
    <h1 class="homeText">Password Vault</h1>
    <br/>
    <b-row class="navbar navbar-default">
      <b-col class="col-sm-3 col-md-3 pull-left">
        <div class="table-responsive">
          | <router-link :to="{ name: 'Create' }">New Account</router-link> | <a href="#" v-on:click.stop="logOut()">Sign Out</a> |
        </div>
      </b-col>
    </b-row>
    
    <b-row>
      <b-col md="12" class="col-xs-12">
        <b-form-group horizontal>
          <b-input-group>
            <b-form-input v-model="filter" placeholder="Search for Account..." />
            <b-input-group-append>
              <b-btn :disabled="!filter" @click="filter = ''">Clear</b-btn>
            </b-input-group-append>
          </b-input-group>
        </b-form-group>
      </b-col>
    </b-row>

    <b-row>
      <b-col md="12">
        <b-table
          :sort-by.sync="sortBy"
          :sort-desc.sync="sortDesc"
          stacked="sm"
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
          :fields="fields"
          v-model="currentAccounts">
          <template v-slot:cell(accountName)="data">
            <span class="d-inline-block text-truncate text-lowercase" style="max-width: 200px;">{{data.item.accountName}}</span>
          </template>          
          <template v-slot:cell(siteName)="data">
            <span class="d-inline-block text-truncate text-lowercase" style="max-width: 250px;">{{data.item.siteName}}</span>
          </template>
          <template v-slot:cell(lastModifiedDate)="data">
            {{ formatDate(data.item.lastModifiedDate) }}
          </template>
          <template v-slot:cell(edit)="data">
            <b-button size="sm" 
              variant="success"
              @click.stop="copyPassword(data.item.id)"><font-awesome-icon icon="copy" ></font-awesome-icon></b-button> |
            <b-button
              size="sm"
              variant="primary"
              @click.stop="displayPassword(data.item.id)"><font-awesome-icon icon="info" ></font-awesome-icon></b-button> |              
            <b-button
              size="sm"
              variant="info"
              @click.stop="updatePassword(data.item.id)"><font-awesome-icon icon="user-edit" ></font-awesome-icon></b-button> |
            <b-button 
              size="sm"
              variant="dark"
              @click.stop="toggleDetails(data.item)"><font-awesome-icon icon="bars" /></b-button> |              
            <b-button
              size="sm"
              variant="danger"
              @click.stop="deletePassword(data.item.id)"><font-awesome-icon icon="trash-alt" ></font-awesome-icon></b-button>             
          </template>          
          <template v-slot:row-details="{ item }">
            <b-card class="text-left">
              <b-card class="text-left">
                <b-row class="mb-2">
                  <b-col><b>Site:</b></b-col>
                  <b-col>{{ item.siteName }}</b-col>
                </b-row>            
                <b-row class="mb-2">
                  <b-col><b>Created By:</b></b-col>
                  <b-col>{{ item.createdBy }}</b-col>
                </b-row>
                <b-row class="mb-2">
                  <b-col><b>Updated By:</b></b-col>
                  <b-col>{{ item.lastModifiedBy }}</b-col>
                </b-row>
                <b-row class="mb-2">
                  <b-col><b>Security Questions:</b></b-col>
                  <b-col></b-col>
                </b-row>
                <span class="mb-2" v-for="securityQuestion in item.securityQuestions" :key="securityQuestion" >
                  <b-row class="mb-2" v-if="securityQuestion.question !== '' && securityQuestion.answer !== '' " >
                    <b-col><i>{{securityQuestion.question}}</i>: </b-col>
                    <b-col>{{securityQuestion.answer}}</b-col>
                  </b-row>
                </span>
                <b-row class="mb-2">
                  <b-col><b>Notes:</b></b-col>
                  <b-col>{{ item.notes }}</b-col>
                </b-row>
              </b-card>         
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
      <p class="my-4 text-monospace">{{alertModalContent}}</p>
    </b-modal>

  </div>
</template>
<style src="./home.css" />
<script src="./home.js"></script>