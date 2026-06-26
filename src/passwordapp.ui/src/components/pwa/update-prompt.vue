<template>
  <div v-if="visible || installVisible" class="pwa-support-banner" role="status" aria-live="polite">
    <div v-if="installVisible" class="pwa-support-item">
      <span class="pwa-support-text">Install Password Vault for faster access and offline app support.</span>
      <Button label="Install" size="small" severity="contrast" @click="install" />
      <Button label="Not now" size="small" severity="secondary" text @click="dismissInstall" />
    </div>
    <div v-if="visible" class="pwa-support-item">
      <span class="pwa-support-text">A new version of Password Vault is available.</span>
      <Button label="Refresh" size="small" severity="contrast" @click="refresh" />
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue';
import { skipWaiting, reloadOnControllerChange } from './sw-update.js';
import { isStandalone, promptInstall, shouldShowInstallPrompt } from './install.js';

// Listens for the 'swUpdated' event emitted by registerServiceWorker.js when a
// new service worker has been installed and is waiting. Shows a non-intrusive
// banner so the user controls when to pick up the new version (rather than the
// app reloading underneath them).
export default {
  name: 'UpdatePrompt',
  setup() {
    const visible = ref(false);
    const installVisible = ref(false);
    let registration = null;
    let installEvent = null;
    let cleanup = null;

    const onUpdated = (event) => {
      registration = event.detail;
      visible.value = true;
    };

    const onBeforeInstallPrompt = (event) => {
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      installEvent = event;
      installVisible.value = shouldShowInstallPrompt(event, isStandalone());
    };

    const onAppInstalled = () => {
      installEvent = null;
      installVisible.value = false;
    };

    const dismissInstall = () => {
      installVisible.value = false;
    };

    const install = () => {
      const event = installEvent;
      installVisible.value = false;
      installEvent = null;
      promptInstall(event);
    };

    const refresh = () => {
      visible.value = false;
      if (registration && 'serviceWorker' in navigator) {
        cleanup = reloadOnControllerChange(navigator.serviceWorker, () => window.location.reload());
        const messaged = skipWaiting(registration, (worker, message) => worker.postMessage(message));
        if (!messaged) {
          window.location.reload();
        }
        return;
      }
      window.location.reload();
    };

    onMounted(() => {
      window.addEventListener('swUpdated', onUpdated);
      window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.addEventListener('appinstalled', onAppInstalled);
    });
    onUnmounted(() => {
      window.removeEventListener('swUpdated', onUpdated);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      if (cleanup) {
        cleanup();
      }
    });

    return { visible, installVisible, dismissInstall, install, refresh };
  },
};
</script>

<style scoped>
.pwa-support-banner {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1080;
  display: grid;
  gap: .75rem;
  padding: 0.75rem 1rem;
  border-top: .5px solid var(--vault-border);
  background: var(--vault-bg);
  color: var(--vault-text);
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.28);
}

.pwa-support-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: .75rem;
}

.pwa-support-text {
  color: var(--vault-muted);
  font-size: .8125rem;
}
</style>
