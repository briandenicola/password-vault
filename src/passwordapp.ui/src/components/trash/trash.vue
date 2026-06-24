<template>
  <div class="container-fluid">
    <h2 class="mb-3">Recycle Bin</h2>

    <div class="row navbar navbar-default mb-3">
      <div class="col table-responsive">
        | <router-link :to="{ name: 'Home' }">Back to Vault</router-link> |
      </div>
    </div>

    <p class="mb-3 text-muted">
      Deleted accounts are kept here so you can recover them. Restore an account
      to return it to your vault.
    </p>

    <Message v-if="error" severity="error" class="mb-3">{{ error }}</Message>
    <Message v-if="message" severity="success" class="mb-3">{{ message }}</Message>

    <div v-if="loading" class="text-muted">Loading…</div>

    <Message v-else-if="entries.length === 0" severity="info" class="mb-3">
      The recycle bin is empty.
    </Message>

    <DataTable v-else :value="entries" stripedRows size="small" responsiveLayout="stack">
      <Column field="accountName" header="Account" sortable>
        <template #body="{ data }">
          <span class="text-lowercase">{{ data.accountName }}</span>
        </template>
      </Column>
      <Column field="siteName" header="Site" sortable>
        <template #body="{ data }">
          <span class="text-lowercase">{{ data.siteName }}</span>
        </template>
      </Column>
      <Column field="lastModifiedDate" header="Deleted" sortable>
        <template #body="{ data }">{{ formatDate(data.lastModifiedDate) }}</template>
      </Column>
      <Column header="">
        <template #body="{ data }">
          <Button
            size="small"
            severity="success"
            icon="pi pi-replay"
            label="Restore"
            :loading="restoringId === data.id"
            @click="restore(data)" />
        </template>
      </Column>
    </DataTable>
  </div>
</template>
<script src="./trash.js"></script>
