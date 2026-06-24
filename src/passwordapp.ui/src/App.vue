<template>
  <div :class="{ 'dark-mode': isDarkMode }">
    <nav class="navbar">
      <button class="btn" @click="toggleDarkMode">
        <font-awesome-icon icon="moon" />
      </button>
    </nav>
  <div id="app" class="container-fluid">
    <PasskeyVaultGate v-if="e2eeEnabled" />
    <div class="row">
      <div class="col"></div>
    </div>
    <div v-if="!e2eeEnabled || sessionState.isUnlocked" class="row">
      <div class="col">
        <router-view/>
      </div>
    </div>
  </div>
    <UpdatePrompt />
  </div> 
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue';
import { IdleTimer } from '@/components/utils/idle-timer.js';
import { vaultSession } from '@/components/crypto/vault-session.js';
import { isE2eeEnabled } from '@/components/crypto/feature-flag.js';
import { loadSettings } from '@/components/settings/settings.store.js';
import Authentication from '@/components/azuread/AzureAD.Authentication.js';
import UpdatePrompt from '@/components/pwa/update-prompt.vue';
import PasskeyVaultGate from '@/components/crypto/PasskeyVaultGate.vue';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

export default {
  components: { UpdatePrompt, PasskeyVaultGate },
  setup() {
    const isDarkMode = ref(localStorage.getItem('darkMode') === 'true');
    const e2eeEnabled = isE2eeEnabled();
    const sessionState = ref({ isUnlocked: vaultSession.isUnlocked, unlockedAt: vaultSession.unlockedAt });

    const toggleDarkMode = () => {
      isDarkMode.value = !isDarkMode.value;
      localStorage.setItem('darkMode', isDarkMode.value);
      if (isDarkMode.value) {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
    };

    if (isDarkMode.value) {
      document.body.classList.add('dark-mode');
    }

    // Auto-lock (UI-2): after the configured idle period, drop in-memory plaintext.
    // With E2EE on this is a soft lock; otherwise keep the existing sign-out behavior.
    let idleTimer = null;
    let lastActivity = 0;
    let unsubscribeSession = null;

    const lock = () => {
      // With E2EE enabled, idle lock is a soft lock: drop the in-memory DEK and
      // show the passkey unlock screen instead of signing out of Entra.
      vaultSession.lock();
      if (e2eeEnabled) {
        return;
      }
      try {
        if (Authentication.isAuthenticated && Authentication.isAuthenticated()) {
          Authentication.signOut();
          return;
        }
      } catch (e) {
        // fall through to reload
      }
      window.location.reload();
    };

    const onActivity = () => {
      // Throttle re-arming so high-frequency events (mousemove/scroll) stay cheap.
      const now = Date.now();
      if (now - lastActivity < 1000) {
        return;
      }
      lastActivity = now;
      if (idleTimer) {
        idleTimer.notifyActivity();
      }
    };

    onMounted(() => {
      unsubscribeSession = vaultSession.subscribe(s => { sessionState.value = s; });
      const settings = loadSettings(Authentication.getUserProfile());
      const minutes = Number(settings.security.autoLockMinutes);
      if (Number.isFinite(minutes) && minutes > 0) {
        idleTimer = new IdleTimer({ timeoutMs: minutes * 60 * 1000, onIdle: lock }).start();
        ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, onActivity, { passive: true }));
      }
    });

    onUnmounted(() => {
      if (unsubscribeSession) {
        unsubscribeSession();
      }
      if (idleTimer) {
        idleTimer.stop();
        ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, onActivity));
      }
    });

    return {
      isDarkMode,
      e2eeEnabled,
      sessionState,
      toggleDarkMode,
    };
  },
};
</script>

<style scoped>
</style>