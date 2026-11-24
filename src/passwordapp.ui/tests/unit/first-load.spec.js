import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const mainJs = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
const routerJs = readFileSync(new URL('../../src/router.js', import.meta.url), 'utf8');

describe('first account load', () => {
  it('starts fetching accounts before the app mounts, only when signed in', () => {
    const prefetch = mainJs.indexOf('useAccountsStore(pinia).fetchAccounts()');
    expect(prefetch).toBeGreaterThan(mainJs.indexOf('await Authentication.initialize()'));
    expect(prefetch).toBeLessThan(mainJs.indexOf("app.mount('#app')"));
    expect(mainJs).toContain('if (!requiresAuthentication || Authentication.isAuthenticated())');
    // Home must reuse the same store instance, so the app installs that pinia.
    expect(mainJs).toContain('app.use(pinia)');
  });

  it('loads App Insights after mount instead of in the main bundle', () => {
    expect(mainJs).not.toMatch(/^import .*applicationinsights/m);
    expect(mainJs.indexOf('loadAppInsights()')).toBeGreaterThan(mainJs.indexOf("app.mount('#app')"));
  });

  it('keeps Home eager and lazy-loads every other page', () => {
    expect(routerJs).toContain("import Home from '@/components/home/home.vue'");
    for (const page of ['create', 'update', 'settings', 'audit', 'trash', 'transfer']) {
      expect(routerJs).toContain(`() => import('@/components/${page}/${page}.vue')`);
      expect(routerJs).not.toContain(`import ${page[0].toUpperCase()}${page.slice(1)} from`);
    }
  });
});
