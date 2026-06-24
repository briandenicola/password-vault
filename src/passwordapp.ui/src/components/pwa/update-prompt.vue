<template>
  <div v-if="visible" class="pwa-update-banner" role="status" aria-live="polite">
    <span class="pwa-update-text">A new version of Password Vault is available.</span>
    <Button label="Refresh" size="small" severity="contrast" @click="refresh" />
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue';
import { skipWaiting, reloadOnControllerChange } from './sw-update.js';

// Listens for the 'swUpdated' event emitted by registerServiceWorker.js when a
// new service worker has been installed and is waiting. Shows a non-intrusive
// banner so the user controls when to pick up the new version (rather than the
// app reloading underneath them).
export default {
  name: 'UpdatePrompt',
  setup() {
    const visible = ref(false);
    let registration = null;
    let cleanup = null;

    const onUpdated = (event) => {
      registration = event.detail;
      visible.value = true;
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

    onMounted(() => window.addEventListener('swUpdated', onUpdated));
    onUnmounted(() => {
      window.removeEventListener('swUpdated', onUpdated);
      if (cleanup) {
        cleanup();
      }
    });

    return { visible, refresh };
  },
};
</script>

<style scoped>
.pwa-update-banner {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1080;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: #202A44;
  color: #fff;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.25);
}

.pwa-update-text {
  font-size: 0.95rem;
}
</style>
