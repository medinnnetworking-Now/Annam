import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { E2E } from './env';
import { totpCode } from '../../src/lib/auth/totp';

export async function signIn(page: Page, user: 'nutritionist' | 'rmclinic' | 'admin', name = `E2E ${user}`) {
  await page.goto('/login');
  await page.getByLabel('Username').fill(user);
  await page.getByLabel('Password').fill(E2E[user]);
  await page.getByLabel('Your name').fill(name);
  if (user === 'admin') await page.getByLabel(/Admin code/).fill(totpCode(E2E.totp));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
}

export async function noSeriousAxe(page: Page) {
  // Measure the settled page: fonts loaded and no requests in flight, so colour contrast is read correctly.
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bad = r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
}
