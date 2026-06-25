<template>
  <div class="container-fluid vault-screen">
    <div class="vault-page-title">
      <h2>Recycle bin</h2>
      <p>Deleted entries linger here so you can recover them.</p>
    </div>

    <Message v-if="error" severity="error" class="mb-3">{{ error }}</Message>
    <Message v-if="message" severity="success" class="mb-3">{{ message }}</Message>

    <div v-if="loading" class="text-muted">Loading…</div>

    <Message v-else-if="entries.length === 0" severity="info" class="mb-3">
      The recycle bin is empty.
    </Message>

    <DataTable v-else :value="entries" stripedRows size="small" responsiveLayout="stack" class="vault-table">
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
