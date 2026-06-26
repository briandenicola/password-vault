import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const appVue = readFileSync(new URL('../../src/App.vue', import.meta.url), 'utf8');

function classicNavTemplate() {
  return appVue.match(/<nav v-if="currentTheme === 'classic'"[\s\S]*?<\/nav>/)?.[0] ?? '';
}

describe('Classic theme navigation', () => {
  it('shows New Account, Settings, then Sign out as Classic-only nav items', () => {
    const classicNav = classicNavTemplate();

    expect(classicNav).toMatch(/New Account[\s\S]*Settings[\s\S]*Sign out/);
    expect(classicNav).toContain('<router-link class="classic-only" :to="{ name: \'Create\' }">New Account</router-link>');
    expect(classicNav).toContain('<router-link class="classic-only" :to="{ name: \'Settings\' }">Settings</router-link>');
    expect(classicNav).not.toContain('pi pi-cog');
  });
});
