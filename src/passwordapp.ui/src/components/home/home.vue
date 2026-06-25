<template>
 <div class="vault-screen">
    <div class="vault-toolbar">
      <div class="vault-page-title">
        <h2>Accounts</h2>
        <p>Your shared vault, sorted and searchable.</p>
      </div>
      <Button label="New account" icon="pi pi-plus" @click="$router.push({ name: 'Create' })" />
    </div>

    <div class="vault-toolbar">
        <div class="d-flex flex-wrap gap-2 align-items-center vault-search">
          <InputText v-model="filter" placeholder="Search for an account..." class="flex-grow-1" />
          <Select
            v-model="selectedTag"
            :options="tagChoices"
            optionLabel="label"
            optionValue="value"
            placeholder="All tags"
            class="tag-filter"
            :showClear="true"
            v-if="allTags.length" />
          <Button label="Clear" severity="secondary" :disabled="!filter && !selectedTag" @click="filter = ''; selectedTag = null;" />
        </div>
    </div>

    <Message v-if="apiError" severity="error" class="mb-3">
      {{ apiError }}
    </Message>

    <div class="row vault-desktop-table">
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
          class="vault-table"
          size="small">
          <Column field="accountName" header="Account" sortable>
            <template #body="{ data }">
              <div class="d-inline-block text-truncate text-lowercase account-name">{{ data.accountName }}</div>
              <div v-if="tagsOf(data).length" class="mt-1">
                <Tag v-for="tag in tagsOf(data)" :key="tag" :value="tag" severity="secondary" class="me-1 mb-1" @click.stop="selectedTag = tag" style="cursor: pointer;" />
              </div>
            </template>
          </Column>
          <Column field="siteName" header="Site" sortable>
            <template #body="{ data }">
              <span class="d-inline-block text-truncate text-lowercase site-name">{{ data.siteName }}</span>
            </template>
          </Column>
          <Column field="lastModifiedDate" header="Last Modified" sortable>
            <template #body="{ data }">
              <div>{{ formatDate(data.lastModifiedDate) }}</div>
              <small
                class="text-muted"
                :class="{ 'fst-italic': isStaleRow(data) }"
                v-tooltip.top="isStaleRow(data) ? 'This password hasn\'t changed in a while — consider updating it.' : null">
                {{ isStaleRow(data) ? staleAgeOf(data) : ageOf(data) }}
              </small>
            </template>
          </Column>
          <Column header="Edit/Remove">
            <template #body="{ data }">
              <div class="d-flex flex-wrap gap-1">
                <Button class="vault-icon-button" size="small" severity="success" @click.stop="copyPassword(data.id)" v-tooltip.top="'Copy'"><font-awesome-icon icon="copy" /></Button>
                <Button class="vault-icon-button" size="small" @click.stop="displayPassword(data.id)" v-tooltip.top="'Reveal'"><font-awesome-icon icon="info" /></Button>
                <Button class="vault-icon-button" size="small" severity="info" @click.stop="updatePassword(data.id)" v-tooltip.top="'Edit'"><font-awesome-icon icon="user-edit" /></Button>
                <Button class="vault-icon-button" size="small" severity="contrast" @click.stop="toggleDetails(data)" v-tooltip.top="'Details'"><font-awesome-icon icon="bars" /></Button>
                <Button class="vault-icon-button" size="small" severity="warn" @click.stop="showHistory(data.id)" v-tooltip.top="'History'"><font-awesome-icon :icon="['fas', 'clock-rotate-left']" /></Button>
                <Button class="vault-icon-button" size="small" severity="danger" @click.stop="deletePassword(data.id)" v-tooltip.top="'Delete'"><font-awesome-icon icon="trash-alt" /></Button>
              </div>
            </template>
          </Column>
          <template #expansion="{ data }">
            <div class="card vault-expansion-card">
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

    <div class="vault-mobile-list" aria-label="Accounts">
      <article v-for="password in mobilePagedPasswords" :key="password.id" class="vault-mobile-account">
        <div class="vault-mobile-account-row">
          <div class="vault-mobile-account-label">Account</div>
          <div class="vault-mobile-account-value">
            <span class="text-lowercase">{{ password.accountName }}</span>
            <div v-if="tagsOf(password).length" class="mt-1">
              <Tag v-for="tag in tagsOf(password)" :key="tag" :value="tag" severity="secondary" class="me-1 mb-1" @click.stop="selectedTag = tag" style="cursor: pointer;" />
            </div>
          </div>
        </div>
        <div class="vault-mobile-account-row">
          <div class="vault-mobile-account-label">Site</div>
          <div class="vault-mobile-account-value text-lowercase">{{ password.siteName }}</div>
        </div>
        <div class="vault-mobile-account-row">
          <div class="vault-mobile-account-label">Last Modified</div>
          <div class="vault-mobile-account-value">
            <div>{{ formatDate(password.lastModifiedDate) }}</div>
            <small
              class="text-muted"
              :class="{ 'fst-italic': isStaleRow(password) }">
              {{ isStaleRow(password) ? staleAgeOf(password) : ageOf(password) }}
            </small>
          </div>
        </div>
        <div class="vault-mobile-account-row">
          <div class="vault-mobile-account-label">Edit/Remove</div>
          <div class="vault-mobile-account-actions">
            <Button class="vault-icon-button" size="small" severity="success" @click.stop="copyPassword(password.id)" v-tooltip.top="'Copy'"><font-awesome-icon icon="copy" /></Button>
            <Button class="vault-icon-button" size="small" @click.stop="displayPassword(password.id)" v-tooltip.top="'Reveal'"><font-awesome-icon icon="info" /></Button>
            <Button class="vault-icon-button" size="small" severity="info" @click.stop="updatePassword(password.id)" v-tooltip.top="'Edit'"><font-awesome-icon icon="user-edit" /></Button>
            <Button class="vault-icon-button" size="small" severity="contrast" @click.stop="toggleDetails(password)" v-tooltip.top="'Details'"><font-awesome-icon icon="bars" /></Button>
            <Button class="vault-icon-button" size="small" severity="warn" @click.stop="showHistory(password.id)" v-tooltip.top="'History'"><font-awesome-icon :icon="['fas', 'clock-rotate-left']" /></Button>
            <Button class="vault-icon-button" size="small" severity="danger" @click.stop="deletePassword(password.id)" v-tooltip.top="'Delete'"><font-awesome-icon icon="trash-alt" /></Button>
          </div>
        </div>
        <div v-if="isDetailsExpanded(password)" class="vault-mobile-details">
          <div><b>Created By:</b> {{ password.createdBy }}</div>
          <div><b>Updated By:</b> {{ password.lastModifiedBy }}</div>
          <div v-if="password.notes"><b>Notes:</b> {{ password.notes }}</div>
          <div v-if="password.securityQuestions && password.securityQuestions.length">
            <b>Security Questions:</b>
            <div v-for="securityQuestion in password.securityQuestions" :key="securityQuestion.question">
              <span v-if="securityQuestion.question !== '' && securityQuestion.answer !== ''">
                <i>{{ securityQuestion.question }}</i>: {{ securityQuestion.answer }}
              </span>
            </div>
          </div>
        </div>
      </article>
      <p v-if="filteredPasswords.length === 0" class="vault-mobile-empty">No accounts found.</p>
      <Paginator
        v-if="filteredPasswords.length > perPage"
        :first="mobileFirst"
        :rows="perPage"
        :totalRecords="filteredPasswords.length"
        :rowsPerPageOptions="[5, 10, 20, 50, 100]"
        @page="onMobilePage" />
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
