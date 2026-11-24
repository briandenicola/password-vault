import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const appVue = readFileSync(new URL('../../src/App.vue', import.meta.url), 'utf8');

function lockFunction() {
  return appVue.match(/const lock = async \(\) => \{[\s\S]*?\n {4}\};/)?.[0] ?? '';
}

describe('idle auto-lock without E2EE', () => {
  it('clears cached tokens instead of signing out of Entra', () => {
    const lock = lockFunction();
    expect(lock).toContain('Authentication.lockSession()');
    // signOut is only the fallback when clearing the cache fails.
    expect(lock).toMatch(/catch \(e\) \{[\s\S]*Authentication\.signOut\(\)/);
    expect(lock.split('Authentication.signOut()')).toHaveLength(2);
  });

  it('hides the vault and drops loaded accounts while locked', () => {
    const lock = lockFunction();
    expect(lock).toContain('idleLocked.value = true');
    expect(lock).toContain('accountsStore.$reset()');
    expect(appVue).toContain('const vaultUnlocked = computed(() => !idleLocked.value &&');
    expect(appVue).toMatch(/<div v-if="idleLocked"[\s\S]*@click="unlockIdle"/);
  });
});
