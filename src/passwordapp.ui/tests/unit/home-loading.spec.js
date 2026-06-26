import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const homeVue = readFileSync(new URL('../../src/components/home/home.vue', import.meta.url), 'utf8');
const homeJs = readFileSync(new URL('../../src/components/home/home.js', import.meta.url), 'utf8');

describe('home account loading state', () => {
  it('shows loading state while the initial account fetch is running', () => {
    expect(homeJs).toContain('initialAccountsLoading()');
    expect(homeJs).toContain('this.accountsStore.loading && !this.accountsStore.isLoaded');
    expect(homeVue).toContain(':loading="initialAccountsLoading"');
    expect(homeVue).toContain('v-if="initialAccountsLoading" class="vault-mobile-loading"');
  });

  it('does not show the mobile empty message until loading finishes', () => {
    expect(homeVue).toMatch(/v-if="initialAccountsLoading"[\s\S]*v-else-if="filteredPasswords\.length === 0"[\s\S]*No accounts found\./);
  });
});
