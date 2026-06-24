<template>
  <div class="container-fluid">
    <h2 class="mb-3">Security Audit</h2>

    <div class="row navbar navbar-default mb-3">
      <div class="col table-responsive">
        | <router-link :to="{ name: 'Home' }">Back to Vault</router-link> |
      </div>
    </div>

    <div class="card mb-3">
      <div class="card-header">Reused / Duplicate Passwords</div>
      <div class="card-body">
        <p class="mb-2">
          Find accounts that share the same password. Reused passwords mean one
          breach can unlock several accounts. Run the check, then give each
          flagged account its own password.
        </p>
        <Button
          label="Run check"
          icon="pi pi-search"
          :loading="loading"
          @click="runReport" />
        <span v-if="hasRun && !loading && !error" class="ms-3 text-muted">
          Scanned {{ totalAccounts }} account{{ totalAccounts === 1 ? '' : 's' }}.
          <span v-if="failedCount">({{ failedCount }} could not be read.)</span>
        </span>
      </div>
    </div>

    <Message v-if="error" severity="error" class="mb-3">{{ error }}</Message>

    <template v-if="hasRun && !loading && !error">
      <Message
        :severity="groups.length === 0 ? 'success' : 'warn'"
        class="mb-3">
        {{ summary }}
      </Message>

      <div v-for="(group, gi) in groups" :key="gi" class="card mb-3">
        <div class="card-header d-flex align-items-center">
          <Tag severity="warn" :value="`Shared by ${group.count}`" class="me-2" />
          <span class="text-muted">These accounts use the same password.</span>
        </div>
        <div class="card-body">
          <DataTable :value="group.accounts" stripedRows size="small" responsiveLayout="stack">
            <Column field="accountName" header="Account">
              <template #body="{ data }">
                <span class="text-lowercase">{{ data.accountName }}</span>
              </template>
            </Column>
            <Column field="siteName" header="Site">
              <template #body="{ data }">
                <span class="text-lowercase">{{ data.siteName }}</span>
              </template>
            </Column>
            <Column header="">
              <template #body="{ data }">
                <Button size="small" severity="info" label="Change" @click="editAccount(data.id)" />
              </template>
            </Column>
          </DataTable>
        </div>
      </div>
    </template>
  </div>
</template>
<script src="./audit.js"></script>
