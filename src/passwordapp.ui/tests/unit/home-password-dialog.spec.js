import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const homeVue = readFileSync(new URL('../../src/components/home/home.vue', import.meta.url), 'utf8');
const homeJs = readFileSync(new URL('../../src/components/home/home.js', import.meta.url), 'utf8');
const homeCss = readFileSync(new URL('../../src/components/home/home.css', import.meta.url), 'utf8');

describe('home password reveal dialog', () => {
  it('uses a dedicated password variant without a close button', () => {
    expect(homeJs).toContain("this.showAlert('Success. . .', response.data.currentPassword, 'password')");
    expect(homeVue).toContain(':closable="alertModalVariant !== \'password\'"');
    expect(homeVue).toContain("'vault-password-dialog': alertModalVariant === 'password'");
  });

  it('styles the Vault password value as centered and larger', () => {
    expect(homeVue).toContain("'vault-password-value': alertModalVariant === 'password'");
    expect(homeCss).toContain('body.theme-vault .vault-password-dialog.p-dialog');
    expect(homeCss).toMatch(/\.vault-password-value[\s\S]*font-size: clamp\(1\.35rem, 5vw, 2rem\);[\s\S]*text-align: center;/);
  });
});
