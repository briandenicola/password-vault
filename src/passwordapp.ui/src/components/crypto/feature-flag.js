// OFF-4 (E2EE) — feature flag. The E2EE unlock UI ships disabled by default and
// is enabled per-device first, then the family (design §9.4). Phase 1 only gates
// the new crypto surface; the existing CRUD/decrypt path is untouched.
export function isE2eeEnabled() {
  return process.env.VUE_APP_E2EE === 'true';
}
