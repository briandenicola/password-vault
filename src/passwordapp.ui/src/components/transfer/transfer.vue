<template>
  <div class="container-fluid vault-screen">
    <div class="vault-page-title">
      <h2>Import &amp; export</h2>
      <p>Bring the band in, or take the set on the road.</p>
    </div>

    <div class="vault-grid">
      <div class="card vault-action-card mb-3">
        <div class="card-body">
          <div class="vault-action-icon"><i class="pi pi-download"></i></div>
          <h3>Export vault</h3>
          <p class="mb-2">
            Download every account to a CSV file (columns: name, url, username,
            password, notes, tags). It re-imports here and into most browsers and
            password managers.
          </p>
          <Message severity="warn" class="mb-3">
            The exported file contains your passwords in plain text. Store it
            securely and delete it when you're done.
          </Message>
          <Button
            label="Export to CSV"
            icon="pi pi-download"
            :loading="exporting"
            @click="exportCsv" />
          <span v-if="exportMessage" class="ms-3 text-success">{{ exportMessage }}</span>
          <Message v-if="exportError" severity="error" class="mt-3">{{ exportError }}</Message>
        </div>
      </div>
    </div>

    <div class="card vault-import-panel mb-3">
      <div class="card-body">
        <div class="vault-action-icon"><i class="pi pi-upload"></i></div>
        <h3>Import accounts</h3>
        <p class="mb-2">
          Import accounts from a CSV file. The importer recognises this app's
          export plus common Bitwarden, 1Password and browser column names. Rows
          missing an account, site/url or password are skipped.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          class="form-control mb-2"
          @change="onFileChange" />

        <div v-if="parsing" class="text-muted">Reading file…</div>

        <template v-if="!parsing && (pending.length || skipped)">
          <Message :severity="pending.length ? 'info' : 'warn'" class="mb-2">
            Ready to import {{ pending.length }} account{{ pending.length === 1 ? '' : 's' }} from
            {{ fileName }}.<span v-if="skipped"> {{ skipped }} row{{ skipped === 1 ? '' : 's' }} will be skipped (missing fields).</span>
          </Message>

          <DataTable v-if="pending.length" :value="pending" stripedRows size="small" :rows="10" paginator responsiveLayout="stack" class="vault-table mb-2">
            <Column field="accountName" header="Account">
              <template #body="{ data }"><span class="text-lowercase">{{ data.accountName }}</span></template>
            </Column>
            <Column field="siteName" header="Site">
              <template #body="{ data }"><span class="text-lowercase">{{ data.siteName }}</span></template>
            </Column>
            <Column header="Tags">
              <template #body="{ data }">
                <Tag v-for="tag in data.tags" :key="tag" :value="tag" severity="secondary" class="me-1" />
              </template>
            </Column>
          </DataTable>

          <Button
            :label="`Import ${pending.length} account${pending.length === 1 ? '' : 's'}`"
            icon="pi pi-upload"
            severity="success"
            :loading="importing"
            :disabled="!canImport"
            @click="importCsv" />
        </template>

        <Message v-if="importMessage" severity="success" class="mt-3">{{ importMessage }}</Message>
        <Message v-if="importError" severity="error" class="mt-3">{{ importError }}</Message>
      </div>
    </div>
  </div>
</template>
<script src="./transfer.js"></script>
