<template>
 <div>
    <h1 class="homeText">Password Vault</h1>
    <br/>
    <div class="row navbar navbar-default">
      <div class="col-sm-12">
        <div class="table-responsive">
          | <router-link :to="{ name: 'Create' }">New Account</router-link> | <router-link :to="{ name: 'Audit' }">Security Audit</router-link> | <router-link :to="{ name: 'Settings' }">Settings</router-link> | <a href="#" v-on:click.stop="logOut()">Sign Out</a> |
        </div>
      </div>
    </div>

    <div class="row">
      <div class="col-12 my-2">
        <div class="d-flex gap-2">
          <InputText v-model="filter" placeholder="Search for Account..." class="flex-grow-1" />
          <Button label="Clear" severity="secondary" :disabled="!filter" @click="filter = ''" />
        </div>
      </div>
    </div>

    <div class="row">
      <div class="col-12">
        <DataTable
          :value="filteredPasswords"
          dataKey="id"
          v-model:expandedRows="expandedRows"
          paginator
          :rows="perPage"
          :rowsPerPageOptions="[5, 10, 20, 50, 100]"
          :sortField="sortBy"
          :sortOrder="sortDesc ? -1 : 1"
          stripedRows
          responsiveLayout="stack"
          size="small">
          <Column field="accountName" header="Account" sortable>
            <template #body="{ data }">
              <span class="d-inline-block text-truncate text-lowercase" style="max-width: 200px;">{{ data.accountName }}</span>
            </template>
          </Column>
          <Column field="siteName" header="Site" sortable>
            <template #body="{ data }">
              <span class="d-inline-block text-truncate text-lowercase" style="max-width: 250px;">{{ data.siteName }}</span>
            </template>
          </Column>
          <Column field="lastModifiedDate" header="Last Modified" sortable>
            <template #body="{ data }">{{ formatDate(data.lastModifiedDate) }}</template>
          </Column>
          <Column header="Edit/Remove">
            <template #body="{ data }">
              <div class="d-flex flex-wrap gap-1">
                <Button size="small" severity="success" @click.stop="copyPassword(data.id)" v-tooltip.top="'Copy'"><font-awesome-icon icon="copy" /></Button>
                <Button size="small" @click.stop="displayPassword(data.id)" v-tooltip.top="'Reveal'"><font-awesome-icon icon="info" /></Button>
                <Button size="small" severity="info" @click.stop="updatePassword(data.id)" v-tooltip.top="'Edit'"><font-awesome-icon icon="user-edit" /></Button>
                <Button size="small" severity="contrast" @click.stop="toggleDetails(data)" v-tooltip.top="'Details'"><font-awesome-icon icon="bars" /></Button>
                <Button size="small" severity="warn" @click.stop="showHistory(data.id)" v-tooltip.top="'History'"><font-awesome-icon :icon="['fas', 'clock-rotate-left']" /></Button>
                <Button size="small" severity="danger" @click.stop="deletePassword(data.id)" v-tooltip.top="'Delete'"><font-awesome-icon icon="trash-alt" /></Button>
              </div>
            </template>
          </Column>
          <template #expansion="{ data }">
            <div class="card text-start">
              <div class="card-body">
                <div class="row mb-2"><div class="col"><b>Site:</b></div><div class="col">{{ data.siteName }}</div></div>
                <div class="row mb-2"><div class="col"><b>Created By:</b></div><div class="col">{{ data.createdBy }}</div></div>
                <div class="row mb-2"><div class="col"><b>Updated By:</b></div><div class="col">{{ data.lastModifiedBy }}</div></div>
                <div class="row mb-2"><div class="col"><b>Security Questions:</b></div><div class="col"></div></div>
                <span class="mb-2" v-for="securityQuestion in data.securityQuestions" :key="securityQuestion.question">
                  <div class="row mb-2" v-if="securityQuestion.question !== '' && securityQuestion.answer !== ''">
                    <div class="col"><i>{{ securityQuestion.question }}</i>:</div>
                    <div class="col">{{ securityQuestion.answer }}</div>
                  </div>
                </span>
                <div class="row mb-2"><div class="col"><b>Notes:</b></div><div class="col">{{ data.notes }}</div></div>
              </div>
            </div>
          </template>
        </DataTable>
      </div>
    </div>

    <Dialog v-model:visible="showDeleteModal" modal header="Confirm your action" :style="{ width: '30rem' }">
      <p class="my-4">Are you sure you want to delete this account?</p>
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="onDeleteCancel" />
        <Button label="Delete" severity="danger" @click="onDeleteConfirm" />
      </template>
    </Dialog>

    <Dialog v-model:visible="showAlertModal" modal :header="alertModalTitle" :style="{ width: '30rem' }">
      <p class="my-4 font-monospace">{{ alertModalContent }}</p>
      <template #footer>
        <Button label="OK" @click="showAlertModal = false" />
      </template>
    </Dialog>

    <Dialog v-model:visible="showHistoryModal" modal header="Password History" :style="{ width: '50rem' }">
      <p v-if="history.length === 0" class="my-4">No password history is available for this account.</p>
      <DataTable v-else :value="history" stripedRows size="small" responsiveLayout="stack">
        <Column header="When">
          <template #body="{ data, index }">
            {{ formatDate(data.timeStamp) }}
            <Tag v-if="index === 0" severity="success" value="Current" class="ms-1" />
          </template>
        </Column>
        <Column header="Password">
          <template #body="{ data }"><span class="font-monospace">{{ data.password }}</span></template>
        </Column>
        <Column header="">
          <template #body="{ data }">
            <Button size="small" severity="success" @click.stop="copyText(data.password)"><font-awesome-icon icon="copy" /></Button>
          </template>
        </Column>
      </DataTable>
      <template #footer>
        <Button label="OK" @click="showHistoryModal = false" />
      </template>
    </Dialog>

  </div>
</template>
<style src="./home.css" />
<script src="./home.js"></script>
