<template>
  <div class="password-generator">
    <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
      <Button label="Generate" severity="success" size="small" @click.stop="generate()" />
      <Button
        :label="showOptions ? 'Hide options' : 'Options'"
        severity="secondary"
        outlined
        size="small"
        @click.stop="showOptions = !showOptions" />
      <small class="ms-2">
        Strength:
        <Tag :severity="strengthVariant" :value="strengthLabel" />
        <span class="text-muted"> (~{{ entropyBits }} bits)</span>
      </small>
    </div>

    <div v-show="showOptions" class="card mb-2">
      <div class="card-body py-2">
        <div class="mb-2">
          <label class="d-block mb-1">Type:</label>
          <span class="me-3">
            <RadioButton v-model="mode" value="password" inputId="gen-mode-password" />
            <label for="gen-mode-password" class="ms-1">Password</label>
          </span>
          <span>
            <RadioButton v-model="mode" value="passphrase" inputId="gen-mode-passphrase" />
            <label for="gen-mode-passphrase" class="ms-1">Passphrase</label>
          </span>
        </div>

        <div v-if="mode === 'password'">
          <div class="mb-2">
            <label class="d-block mb-1">Length: {{ passwordOptions.length }}</label>
            <input
              type="range"
              class="form-range"
              min="8"
              max="64"
              step="1"
              v-model.number="passwordOptions.length" />
          </div>
          <span class="me-3"><Checkbox v-model="passwordOptions.uppercase" :binary="true" inputId="gen-up" /> <label for="gen-up" class="ms-1">A-Z</label></span>
          <span class="me-3"><Checkbox v-model="passwordOptions.lowercase" :binary="true" inputId="gen-low" /> <label for="gen-low" class="ms-1">a-z</label></span>
          <span class="me-3"><Checkbox v-model="passwordOptions.digits" :binary="true" inputId="gen-dig" /> <label for="gen-dig" class="ms-1">0-9</label></span>
          <span class="me-3"><Checkbox v-model="passwordOptions.symbols" :binary="true" inputId="gen-sym" /> <label for="gen-sym" class="ms-1">!@#</label></span>
          <span class="me-3"><Checkbox v-model="passwordOptions.excludeAmbiguous" :binary="true" inputId="gen-amb" /> <label for="gen-amb" class="ms-1">Exclude ambiguous (O/0, l/1…)</label></span>
        </div>

        <div v-else>
          <div class="mb-2">
            <label class="d-block mb-1">Words: {{ passphraseOptions.words }}</label>
            <input
              type="range"
              class="form-range"
              min="3"
              max="10"
              step="1"
              v-model.number="passphraseOptions.words" />
          </div>
          <div class="mb-2">
            <label class="d-block mb-1">Separator:</label>
            <Select
              v-model="passphraseOptions.separator"
              :options="separatorChoices"
              optionLabel="text"
              optionValue="value"
              size="small"
              class="vault-select" />
          </div>
          <span class="me-3"><Checkbox v-model="passphraseOptions.capitalize" :binary="true" inputId="gen-cap" /> <label for="gen-cap" class="ms-1">Capitalize</label></span>
          <span class="me-3"><Checkbox v-model="passphraseOptions.includeNumber" :binary="true" inputId="gen-num" /> <label for="gen-num" class="ms-1">Add a number</label></span>
        </div>
      </div>
    </div>

    <Message v-if="errorMessage" severity="error" class="py-1 my-1">
      <small>{{ errorMessage }}</small>
    </Message>
  </div>
</template>

<script src="./generator.js"></script>
