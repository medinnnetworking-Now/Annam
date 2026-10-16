import { expect, test } from '@playwright/test';
import { signIn, signOut, noSeriousAxe } from './helpers';

test('signed-out visitors go to sign-in, and private routes give nothing', async ({ page, request }) => {
  await page.goto('/patients');
  await expect(page).toHaveURL(/\/login/);
  await noSeriousAxe(page);
  expect((await request.get('/api/photos/00000000-0000-0000-0000-000000000000')).status()).toBe(404);
  expect((await request.get('/api/admin/audit')).status()).toBe(404);
  expect((await request.get('/api/cron/retention')).status()).toBe(404);
});

test('a wrong password is refused with a plain message', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('rmclinic');
  await page.getByLabel('Password').fill('wrong');
  await page.getByLabel('Your name').fill('Someone');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('form').getByRole('alert')).toContainText('do not match');
});

test('admin needs the two-factor code', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('e2e-admin-pass');
  await page.getByLabel('Your name').fill('Admin person');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('form').getByRole('alert')).toContainText('code');
});

test('each role lands on its home and sees only what it may', async ({ page }) => {
  await signIn(page, 'nutritionist');
  await expect(page).toHaveURL(/\/patients$/);
  await expect(page.getByRole('button', { name: 'Add patient' })).toHaveCount(0);
  await page.goto('/admin/audit');
  await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
  await signOut(page);

  await signIn(page, 'rmclinic');
  await expect(page).toHaveURL(/\/patients$/);
  await expect(page.getByRole('button', { name: 'Add patient' })).toBeVisible();
  await expect(page.getByText('Sample patient A')).toBeVisible();
  await page.goto('/patients/00000000-0000-0000-0000-000000000000');
  await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
  await page.goto('/patients/not-a-uuid');
  await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
  await signOut(page);

  await signIn(page, 'admin');
  await expect(page).toHaveURL(/\/cohort$/);
  await expect(page.getByRole('heading', { name: 'Cohort' })).toBeVisible();
  await expect(page.getByText('Sample patient')).toHaveCount(0);
  await noSeriousAxe(page);
  await page.goto('/patients');
  await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
  await page.goto('/admin/audit');
  await expect(page.getByRole('cell', { name: 'sign_in' }).first()).toBeVisible();
  await noSeriousAxe(page);
});
