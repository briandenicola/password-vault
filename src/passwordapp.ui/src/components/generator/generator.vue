<template>
  <div class="password-generator">
    <b-row class="mb-1">
      <b-col sm="auto">
        <b-button size="sm" variant="success" @click.stop="generate()">Generate</b-button>
        <b-button size="sm" variant="outline-secondary" @click.stop="showOptions = !showOptions">
          {{ showOptions ? 'Hide options' : 'Options' }}
        </b-button>
      </b-col>
      <b-col sm="auto" class="pt-1">
        <small>
          Strength:
          <b-badge :variant="strengthVariant">{{ strengthLabel }}</b-badge>
          <span class="text-muted"> (~{{ entropyBits }} bits)</span>
        </small>
      </b-col>
    </b-row>

    <b-collapse v-model="showOptions">
      <b-card class="mb-2" body-class="py-2">
        <b-form-group label="Type:" class="mb-2">
          <b-form-radio-group v-model="mode" size="sm">
            <b-form-radio value="password">Password</b-form-radio>
            <b-form-radio value="passphrase">Passphrase</b-form-radio>
          </b-form-radio-group>
        </b-form-group>

        <div v-if="mode === 'password'">
          <b-form-group :label="`Length: ${passwordOptions.length}`" class="mb-2">
            <b-form-input
              v-model.number="passwordOptions.length"
              type="range"
              min="8"
              max="64"
              step="1" />
          </b-form-group>
          <b-form-checkbox v-model="passwordOptions.uppercase" inline>A-Z</b-form-checkbox>
          <b-form-checkbox v-model="passwordOptions.lowercase" inline>a-z</b-form-checkbox>
          <b-form-checkbox v-model="passwordOptions.digits" inline>0-9</b-form-checkbox>
          <b-form-checkbox v-model="passwordOptions.symbols" inline>!@#</b-form-checkbox>
          <b-form-checkbox v-model="passwordOptions.excludeAmbiguous" inline>
            Exclude ambiguous (O/0, l/1…)
          </b-form-checkbox>
        </div>

        <div v-else>
          <b-form-group :label="`Words: ${passphraseOptions.words}`" class="mb-2">
            <b-form-input
              v-model.number="passphraseOptions.words"
              type="range"
              min="3"
              max="10"
              step="1" />
          </b-form-group>
          <b-form-group label="Separator:" class="mb-2">
            <b-form-select
              v-model="passphraseOptions.separator"
              :options="separatorChoices"
              size="sm" />
          </b-form-group>
          <b-form-checkbox v-model="passphraseOptions.capitalize" inline>Capitalize</b-form-checkbox>
          <b-form-checkbox v-model="passphraseOptions.includeNumber" inline>Add a number</b-form-checkbox>
        </div>
      </b-card>
    </b-collapse>

    <b-alert :show="!!errorMessage" variant="danger" class="py-1 my-1">
      <small>{{ errorMessage }}</small>
    </b-alert>
  </div>
</template>

<script src="./generator.js"></script>
