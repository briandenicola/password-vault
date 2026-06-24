<template>
  <div class="container-fluid">
    <h2 class="mb-3">Settings</h2>

    <div class="row navbar navbar-default mb-3">
      <div class="col table-responsive">
        | <router-link :to="{ name: 'Home' }">Back to Vault</router-link> |
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
            <Select v-model="settings.generator.passphrase.separator" :options="separatorChoices" optionLabel="text" optionValue="value" size="small" />
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
          <div class="col"><Select v-model="settings.list.sortBy" :options="sortChoices" optionLabel="text" optionValue="value" size="small" /></div>
        </div>
        <div class="row mb-2">
          <label class="col-3 col-form-label">Direction:</label>
          <div class="col"><Select v-model="settings.list.sortDesc" :options="directionChoices" optionLabel="text" optionValue="value" size="small" /></div>
        </div>
        <div class="row mb-2">
          <label class="col-3 col-form-label">Rows per page:</label>
          <div class="col"><Select v-model="settings.list.perPage" :options="perPageChoices" size="small" /></div>
        </div>
      </div>
    </div>

    <!-- Security -->
    <div class="card mb-3">
      <div class="card-header">Security</div>
      <div class="card-body">
        <div class="row mb-2">
          <label class="col-4 col-form-label">Auto-clear clipboard:</label>
          <div class="col"><Select v-model="settings.security.clipboardClearSeconds" :options="clipboardClearChoices" optionLabel="text" optionValue="value" size="small" /></div>
        </div>
        <div class="row mb-2">
          <label class="col-4 col-form-label">Auto-lock after idle:</label>
          <div class="col"><Select v-model="settings.security.autoLockMinutes" :options="autoLockChoices" optionLabel="text" optionValue="value" size="small" /></div>
        </div>
        <small class="text-muted d-block">
          Copied passwords are wiped from the clipboard after the selected delay. Auto-lock signs you out
          after a period of inactivity. Changes to auto-lock take effect after reloading the app.
        </small>
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
