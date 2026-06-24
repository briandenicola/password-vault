<template>
  <div class="card my-3">
    <div class="card-header">Vault encryption</div>
    <div class="card-body">
      <Message v-if="error" severity="error" class="mb-3">{{ error }}</Message>
      <Message v-if="info" severity="success" class="mb-3">{{ info }}</Message>

      <div v-if="loading">Loading encryption status…</div>

      <div v-else-if="!isUnlocked && !hasRecord">
        <h3 class="h5">Enroll your encryption passkey</h3>
        <p>Creates the vault DEK, wraps it with a PRF-capable passkey, and saves a recovery copy.</p>
        <InputText v-model="label" placeholder="Passkey label (Brian phone)" class="me-2 mb-2" />
        <Button label="Enroll passkey" :disabled="busy" @click="enrollFirst" />
      </div>

      <div v-else-if="!isUnlocked">
        <h3 class="h5">Unlock vault</h3>
        <p>Use your enrolled passkey to restore the in-memory vault key.</p>
        <Button label="Unlock with passkey" :disabled="busy" @click="unlock" />
        <div class="mt-3">
          <InputText v-model="recoveryKey" placeholder="Recovery key" class="me-2 mb-2" />
          <Button label="Unlock with recovery key" severity="secondary" :disabled="busy || !recoveryKey" @click="unlockRecovery" />
        </div>
      </div>

      <div v-else>
        <div class="d-flex flex-wrap gap-2 align-items-center">
          <Tag severity="success" value="Unlocked" />
          <Button label="Lock" severity="secondary" size="small" @click="lock" />
        </div>
        <div class="mt-3">
          <h3 class="h6">Enroll an additional passkey</h3>
          <InputText v-model="label" placeholder="New passkey label" class="me-2 mb-2" />
          <Button label="Add passkey" size="small" :disabled="busy" @click="addPasskey" />
        </div>
      </div>

      <Dialog v-model:visible="showRecovery" modal header="Save this recovery key" :closable="false" :style="{ width: '34rem' }">
        <p>This is shown once. Print it or store it offline before continuing.</p>
        <p class="font-monospace fs-5">{{ recoveryKeyDisplay }}</p>
        <template #footer>
          <Button label="I saved it" @click="showRecovery = false" />
        </template>
      </Dialog>
    </div>
  </div>
</template>

<script>
import { vaultSession } from './vault-session.js';
import { getVaultKeyRecord } from './vault-key-api.js';
import {
  enrollFirstPasskey,
  enrollAdditionalPasskey,
  unlockVaultWithPasskey,
  unlockVaultWithRecoveryKey,
} from './e2ee-flow.js';
import Authentication from '@/components/azuread/AzureAD.Authentication.js';

export default {
  name: 'PasskeyVaultGate',
  data() {
    return {
      loading: true,
      busy: false,
      hasRecord: false,
      isUnlocked: vaultSession.isUnlocked,
      label: '',
      recoveryKey: '',
      recoveryKeyDisplay: '',
      showRecovery: false,
      error: '',
      info: '',
      unsubscribe: null,
    };
  },
  async mounted() {
    this.unsubscribe = vaultSession.subscribe(s => { this.isUnlocked = s.isUnlocked; });
    await this.refreshRecord();
  },
  unmounted() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  },
  methods: {
    async refreshRecord() {
      this.loading = true;
      this.error = '';
      try {
        this.hasRecord = !!(await getVaultKeyRecord());
      } catch (e) {
        this.error = 'Unable to load vault-key record: ' + e;
      } finally {
        this.loading = false;
      }
    },
    async enrollFirst() {
      await this.run(async () => {
        const userName = Authentication.getUserProfile() || 'password-vault-user';
        const result = await enrollFirstPasskey({ label: this.label, userName, displayName: userName });
        this.recoveryKeyDisplay = result.recoveryKey;
        this.showRecovery = true;
        this.hasRecord = true;
        this.info = 'Passkey enrolled and vault unlocked.';
      });
    },
    async unlock() {
      await this.run(async () => {
        await unlockVaultWithPasskey();
        this.info = 'Vault unlocked.';
      });
    },
    async unlockRecovery() {
      await this.run(async () => {
        await unlockVaultWithRecoveryKey({ recoveryKey: this.recoveryKey });
        this.recoveryKey = '';
        this.info = 'Vault unlocked with recovery key.';
      });
    },
    async addPasskey() {
      await this.run(async () => {
        const userName = Authentication.getUserProfile() || 'password-vault-user';
        await enrollAdditionalPasskey({ label: this.label, userName, displayName: userName });
        this.label = '';
        this.info = 'Additional passkey enrolled.';
        await this.refreshRecord();
      });
    },
    lock() {
      vaultSession.lock();
      this.info = 'Vault locked.';
    },
    async run(action) {
      this.busy = true;
      this.error = '';
      this.info = '';
      try {
        await action();
      } catch (e) {
        this.error = String(e && e.message ? e.message : e);
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>
