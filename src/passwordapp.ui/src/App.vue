<template>
  <div :class="{ 'dark-mode': isDarkMode }">
    <nav class="navbar">
      <button class="btn" @click="toggleDarkMode">
        <font-awesome-icon icon="moon" />
      </button>
    </nav>
  <b-container fluid id="app">
    <b-row>
      <b-col />
    </b-row>
    <b-row>
      <b-col>
        <router-view/>
      </b-col>
    </b-row>
  </b-container>
  </div> 
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue';
import { IdleTimer } from '@/components/utils/idle-timer.js';
import { loadSettings } from '@/components/settings/settings.store.js';
import Authentication from '@/components/azuread/AzureAD.Authentication.js';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

export default {
  setup() {
    const isDarkMode = ref(localStorage.getItem('darkMode') === 'true');

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

    // Auto-lock (UI-2): after the configured idle period, drop any in-memory plaintext
    // and require re-authentication. Re-auth happens via a full sign-out redirect; when
    // auth is disabled (local/dev) we fall back to a reload that wipes in-memory state.
    let idleTimer = null;
    let lastActivity = 0;

    const lock = () => {
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
      const settings = loadSettings(Authentication.getUserProfile());
      const minutes = Number(settings.security.autoLockMinutes);
      if (Number.isFinite(minutes) && minutes > 0) {
        idleTimer = new IdleTimer({ timeoutMs: minutes * 60 * 1000, onIdle: lock }).start();
        ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, onActivity, { passive: true }));
      }
    });

    onUnmounted(() => {
      if (idleTimer) {
        idleTimer.stop();
        ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, onActivity));
      }
    });

    return {
      isDarkMode,
      toggleDarkMode,
    };
  },
};
</script>

<style scoped>
</style>