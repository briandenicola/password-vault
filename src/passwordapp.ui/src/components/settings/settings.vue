<template>
  <div class="container-fluid vault-screen">
    <div class="vault-page-title">
      <h2>Settings</h2>
      <p>Arrange the room to your taste.</p>
    </div>

    <!-- Appearance -->
    <div class="card mb-3">
      <div class="card-header">Appearance</div>
      <div class="card-body">
        <div class="row mb-2">
          <label class="col-4 col-form-label">Theme:</label>
          <div class="col"><Select v-model="settings.appearance.theme" :options="themeChoices" optionLabel="text" optionValue="value" size="small" class="vault-select" /></div>
        </div>
        <small class="text-muted d-block">
          Classic restores the older light, table-first layout. Roman/Classical Bank keeps the vault shell with marble-and-bronze styling.
        </small>
      </div>
    </div>

    <!-- Password generator defaults -->
    <div class="card mb-3">
      <div class="card-header">Password Generator Defaults</div>
      <div class="card-body">
        <div class="mb-2">
          <label class="d-block mb-1">Default type:</label>
          <span class="me-3">
            <RadioButton v-model="settings.generator.mode" value="password" inputId="set-mode-password" />
            <label for="set-mode-password" class="ms-1">Password</label>
          </span>
          <span>
            <RadioButton v-model="settings.generator.mode" value="passphrase" inputId="set-mode-passphrase" />
            <label for="set-mode-passphrase" class="ms-1">Passphrase</label>
          </span>
        </div>

        <div v-if="settings.generator.mode === 'password'">
          <div class="mb-2">
            <label class="d-block mb-1">Length: {{ settings.generator.password.length }}</label>
            <input type="range" class="form-range" min="8" max="64" step="1" v-model.number="settings.generator.password.length" />
          </div>
          <span class="me-3"><Checkbox v-model="settings.generator.password.uppercase" :binary="true" inputId="set-up" /> <label for="set-up" class="ms-1">A-Z</label></span>
          <span class="me-3"><Checkbox v-model="settings.generator.password.lowercase" :binary="true" inputId="set-low" /> <label for="set-low" class="ms-1">a-z</label></span>
          <span class="me-3"><Checkbox v-model="settings.generator.password.digits" :binary="true" inputId="set-dig" /> <label for="set-dig" class="ms-1">0-9</label></span>
          <span class="me-3"><Checkbox v-model="settings.generator.password.symbols" :binary="true" inputId="set-sym" /> <label for="set-sym" class="ms-1">!@#</label></span>
          <span class="me-3"><Checkbox v-model="settings.generator.password.excludeAmbiguous" :binary="true" inputId="set-amb" /> <label for="set-amb" class="ms-1">Exclude ambiguous (O/0, l/1…)</label></span>
        </div>

        <div v-else>
          <div class="mb-2">
            <label class="d-block mb-1">Words: {{ settings.generator.passphrase.words }}</label>
            <input type="range" class="form-range" min="3" max="10" step="1" v-model.number="settings.generator.passphrase.words" />
          </div>
          <div class="mb-2">
            <label class="d-block mb-1">Separator:</label>
            <Select v-model="settings.generator.passphrase.separator" :options="separatorChoices" optionLabel="text" optionValue="value" size="small" class="vault-select" />
          </div>
          <span class="me-3"><Checkbox v-model="settings.generator.passphrase.capitalize" :binary="true" inputId="set-cap" /> <label for="set-cap" class="ms-1">Capitalize</label></span>
          <span class="me-3"><Checkbox v-model="settings.generator.passphrase.includeNumber" :binary="true" inputId="set-num" /> <label for="set-num" class="ms-1">Add a number</label></span>
        </div>

        <small class="text-muted d-block mt-2">Estimated strength: ~{{ generatorEntropy }} bits</small>
      </div>
    </div>

    <!-- Vault list defaults -->
    <div class="card mb-3">
      <div class="card-header">Vault List Defaults</div>
      <div class="card-body">
        <div class="row mb-2">
          <label class="col-3 col-form-label">Sort by:</label>
          <div class="col"><Select v-model="settings.list.sortBy" :options="sortChoices" optionLabel="text" optionValue="value" size="small" class="vault-select" /></div>
        </div>
        <div class="row mb-2">
          <label class="col-3 col-form-label">Direction:</label>
          <div class="col"><Select v-model="settings.list.sortDesc" :options="directionChoices" optionLabel="text" optionValue="value" size="small" class="vault-select" /></div>
        </div>
        <div class="row mb-2">
          <label class="col-3 col-form-label">Rows per page:</label>
          <div class="col"><Select v-model="settings.list.perPage" :options="perPageChoices" size="small" class="vault-select" /></div>
        </div>
        <div class="row mb-2">
          <label class="col-3 col-form-label">Flag passwords older than:</label>
          <div class="col"><Select v-model="settings.list.staleAfterMonths" :options="staleChoices" optionLabel="text" optionValue="value" size="small" class="vault-select" /></div>
        </div>
      </div>
    </div>

    <!-- Security -->
    <div class="card mb-3">
      <div class="card-header">Security</div>
      <div class="card-body">
        <div class="row mb-2">
          <label class="col-4 col-form-label">Auto-clear clipboard:</label>
          <div class="col"><Select v-model="settings.security.clipboardClearSeconds" :options="clipboardClearChoices" optionLabel="text" optionValue="value" size="small" class="vault-select" /></div>
        </div>
        <div class="row mb-2">
          <label class="col-4 col-form-label">Auto-lock after idle:</label>
          <div class="col"><Select v-model="settings.security.autoLockMinutes" :options="autoLockChoices" optionLabel="text" optionValue="value" size="small" class="vault-select" /></div>
        </div>
        <small class="text-muted d-block">
          Copied passwords are wiped from the clipboard after the selected delay. Auto-lock signs you out
          after a period of inactivity. Changes to auto-lock take effect after reloading the app.
        </small>
      </div>
    </div>

    <!-- Backups -->
    <div class="card mb-3">
      <div class="card-header">Encrypted Vault Backups</div>
      <div class="card-body">
        <p class="mb-3">
          Schedule a server-side export of all Cosmos password documents to private blob storage.
          Password fields stay encrypted; the backup is zipped before upload.
        </p>

        <div class="row mb-2">
          <label class="col-4 col-form-label">Scheduled backups:</label>
          <div class="col d-flex align-items-center">
            <Checkbox v-model="backupSettings.enabled" :binary="true" inputId="backup-enabled" />
            <label for="backup-enabled" class="ms-2">Enabled</label>
          </div>
        </div>
        <div class="row mb-2">
          <label class="col-4 col-form-label">Frequency:</label>
          <div class="col"><Select v-model="backupSettings.frequency" :options="backupFrequencyChoices" optionLabel="text" optionValue="value" size="small" class="vault-select" /></div>
        </div>
        <div v-if="backupSettings.frequency === 'weekly'" class="row mb-2">
          <label class="col-4 col-form-label">Day of week:</label>
          <div class="col"><Select v-model="backupSettings.dayOfWeek" :options="dayOfWeekChoices" optionLabel="text" optionValue="value" size="small" class="vault-select" /></div>
        </div>
        <div v-if="backupSettings.frequency === 'monthly'" class="row mb-2">
          <label class="col-4 col-form-label">Day of month:</label>
          <div class="col"><Select v-model="backupSettings.dayOfMonth" :options="dayOfMonthChoices" size="small" class="vault-select" /></div>
        </div>
        <div class="row mb-2">
          <label class="col-4 col-form-label">Time:</label>
          <div class="col"><InputText v-model="backupSettings.timeOfDay" type="time" size="small" class="vault-select" /></div>
        </div>
        <div class="row mb-2">
          <label class="col-4 col-form-label">Time zone:</label>
          <div class="col"><InputText v-model="backupSettings.timeZoneId" size="small" class="vault-select" placeholder="UTC" /></div>
        </div>
        <div class="row mb-2">
          <label class="col-4 col-form-label">Keep backups:</label>
          <div class="col"><Select v-model="backupSettings.retentionCount" :options="retentionChoices" size="small" class="vault-select" /></div>
        </div>

        <small class="text-muted d-block">
          Timer checks run every 15 minutes, then apply this schedule. Last status:
          {{ backupSettings.lastStatus || 'Not configured' }}
          <span v-if="backupSettings.lastBackupBlobName">({{ backupSettings.lastBackupBlobName }})</span>
        </small>
        <div class="mt-3">
          <Button
            size="small"
            severity="info"
            label="Run Now"
            icon="pi pi-play"
            :loading="backupRunningNow"
            :disabled="backupSettingsLoading || backupRunningNow"
            @click.stop="runBackupNow()" />
        </div>
        <Message v-if="backupSettingsError" severity="error" class="mt-2 py-2">{{ backupSettingsError }}</Message>
        <Message v-else-if="backupSettingsLoading" severity="info" class="mt-2 py-2">Loading backup schedule...</Message>
      </div>
    </div>

    <div class="row">
      <div class="col d-flex gap-2">
        <Button size="small" severity="info" label="Save" @click.stop="save()" />
        <Button size="small" severity="secondary" outlined label="Reset to defaults" @click.stop="resetToDefaults()" />
      </div>
    </div>

    <Message v-if="savedMessage" severity="success" class="mt-3 py-2">{{ savedMessage }}</Message>
  </div>
</template>

<script src="./settings.js"></script>
