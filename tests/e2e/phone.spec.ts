import { expect, test } from '@playwright/test';
import { signIn, noSeriousAxe } from './helpers';

// Phone layout at 390 px: no sideways page scroll, dialogs as bottom sheets, and screenshots for review.
test('works on a 390 px phone', async ({ page }) => {
  await signIn(page, 'rmclinic', 'Phone check');
  const noSideScroll = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await noSideScroll();
  await page.screenshot({ path: 'test-results/screens/phone-patients.png', fullPage: true });
  await page.getByText('Sample patient A').click();
  await expect(page.getByRole('heading', { name: 'Health score' })).toBeVisible();
  await noSideScroll();
  await noSeriousAxe(page);
  await page.screenshot({ path: 'test-results/screens/phone-overview.png', fullPage: true });
  await page.getByRole('link', { name: 'Plates' }).click();
  await page.getByRole('button', { name: 'Upload plate' }).click();
  const box = await page.getByRole('dialog').boundingBox();
  expect(Math.round(box!.width)).toBe(390);
  await page.screenshot({ path: 'test-results/screens/phone-upload.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Report' }).click();
  await noSideScroll();
  await page.screenshot({ path: 'test-results/screens/phone-report.png', fullPage: true });
});
