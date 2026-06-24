<template>
  <b-container fluid>
    <h2 class="mb-3">Settings</h2>

    <b-row class="navbar navbar-default mb-3">
      <b-col class="table-responsive">
        | <router-link :to="{ name: 'Home' }">Back to Vault</router-link> |
      </b-col>
    </b-row>

    <!-- Password generator defaults -->
    <b-card class="mb-3" header="Password Generator Defaults">
      <b-form-group label="Default type:" class="mb-2">
        <b-form-radio-group v-model="settings.generator.mode">
          <b-form-radio value="password">Password</b-form-radio>
          <b-form-radio value="passphrase">Passphrase</b-form-radio>
        </b-form-radio-group>
      </b-form-group>

      <div v-if="settings.generator.mode === 'password'">
        <b-form-group :label="`Length: ${settings.generator.password.length}`" class="mb-2">
          <b-form-input
            v-model.number="settings.generator.password.length"
            type="range"
            min="8"
            max="64"
            step="1" />
        </b-form-group>
        <b-form-checkbox v-model="settings.generator.password.uppercase" inline>A-Z</b-form-checkbox>
        <b-form-checkbox v-model="settings.generator.password.lowercase" inline>a-z</b-form-checkbox>
        <b-form-checkbox v-model="settings.generator.password.digits" inline>0-9</b-form-checkbox>
        <b-form-checkbox v-model="settings.generator.password.symbols" inline>!@#</b-form-checkbox>
        <b-form-checkbox v-model="settings.generator.password.excludeAmbiguous" inline>
          Exclude ambiguous (O/0, l/1…)
        </b-form-checkbox>
      </div>

      <div v-else>
        <b-form-group :label="`Words: ${settings.generator.passphrase.words}`" class="mb-2">
          <b-form-input
            v-model.number="settings.generator.passphrase.words"
            type="range"
            min="3"
            max="10"
            step="1" />
        </b-form-group>
        <b-form-group label="Separator:" class="mb-2">
          <b-form-select
            v-model="settings.generator.passphrase.separator"
            :options="separatorChoices"
            size="sm" />
        </b-form-group>
        <b-form-checkbox v-model="settings.generator.passphrase.capitalize" inline>Capitalize</b-form-checkbox>
        <b-form-checkbox v-model="settings.generator.passphrase.includeNumber" inline>Add a number</b-form-checkbox>
      </div>

      <small class="text-muted d-block mt-2">Estimated strength: ~{{ generatorEntropy }} bits</small>
    </b-card>

    <!-- Vault list defaults -->
    <b-card class="mb-3" header="Vault List Defaults">
      <b-form-group label="Sort by:" :label-cols="3" class="mb-2">
        <b-form-select v-model="settings.list.sortBy" :options="sortChoices" size="sm" />
      </b-form-group>
      <b-form-group label="Direction:" :label-cols="3" class="mb-2">
        <b-form-select v-model="settings.list.sortDesc" :options="directionChoices" size="sm" />
      </b-form-group>
      <b-form-group label="Rows per page:" :label-cols="3" class="mb-2">
        <b-form-select v-model.number="settings.list.perPage" :options="perPageChoices" size="sm" />
      </b-form-group>
    </b-card>

    <b-row>
      <b-col>
        <b-button size="sm" variant="info" @click.stop="save()">Save</b-button> |
        <b-button size="sm" variant="outline-secondary" @click.stop="resetToDefaults()">Reset to defaults</b-button>
      </b-col>
    </b-row>

    <b-alert :show="!!savedMessage" variant="success" class="mt-3 py-2">
      {{ savedMessage }}
    </b-alert>
  </b-container>
</template>

<script src="./settings.js"></script>
