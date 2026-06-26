import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const appVue = readFileSync(new URL('../../src/App.vue', import.meta.url), 'utf8');
const mainCss = readFileSync(new URL('../../src/css/main.css', import.meta.url), 'utf8');

function classicNavTemplate() {
  return appVue.match(/<nav v-if="currentTheme === 'classic'"[\s\S]*?<\/nav>/)?.[0] ?? '';
}

describe('Classic theme navigation', () => {
  it('shows Accounts, New Account, Settings, then Sign out as Classic-only nav items', () => {
    const classicNav = classicNavTemplate();

    expect(classicNav).toMatch(/Accounts[\s\S]*New Account[\s\S]*Settings[\s\S]*Sign out/);
    expect(classicNav).toContain('<router-link class="classic-only" :to="{ name: \'Home\' }">Accounts</router-link>');
    expect(classicNav).toContain('<router-link class="classic-only" :to="{ name: \'Create\' }">New Account</router-link>');
    expect(classicNav).toContain('<router-link class="classic-only" :to="{ name: \'Settings\' }">Settings</router-link>');
    expect(classicNav).toContain('icon="right-from-bracket"');
    expect(classicNav).not.toContain('pi pi-cog');
  });

  it('uses the same shell width as the other themes', () => {
    expect(mainCss).toMatch(/body\.theme-classic \.vault-app \{[\s\S]*width: min\(100%, 1080px\);/);
  });

  it('moves Classic sign out to an upper-left icon on mobile', () => {
    expect(mainCss).toMatch(/body\.theme-classic \.vault-nav-classic \.classic-sign-out \{[\s\S]*position: absolute;[\s\S]*top: \.85rem;[\s\S]*left: 1rem;/);
    expect(mainCss).toMatch(/body\.theme-classic \.classic-sign-out-text \{[\s\S]*clip: rect\(0, 0, 0, 0\);/);
  });

  it('left-aligns the Classic mobile nav with the account table', () => {
    expect(mainCss).toMatch(/body\.theme-classic \.vault-nav \{[\s\S]*justify-content: flex-start;/);
    expect(mainCss).toMatch(/body\.theme-classic \.vault-nav-classic \{[\s\S]*padding-inline: 1\.5rem 1rem;/);
  });
});
