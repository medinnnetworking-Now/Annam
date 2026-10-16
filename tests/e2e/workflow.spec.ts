import { expect, test, type Page } from '@playwright/test';
import { signIn, signOut, noSeriousAxe } from './helpers';

// A small valid JPEG made in the browser, as a phone camera would supply.
async function photoFile(page: Page) {
  const b64 = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1600; c.height = 1200; const x = c.getContext('2d')!; x.fillStyle = '#7DB06B'; x.fillRect(0, 0, 1600, 1200); x.fillStyle = '#E3A03A'; x.fillRect(400, 300, 600, 500); return c.toDataURL('image/jpeg', 0.95).split(',')[1]!; });
  return { name: 'plate.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') };
}

test('the full programme, from walk-in to the patient summary', async ({ page }) => {
  test.setTimeout(180_000);
  // Clinic staff: walk-in, consent, baseline.
  await signIn(page, 'rmclinic', 'Asha (front desk)');
  await page.getByRole('button', { name: 'Add patient' }).click();
  const dlg = page.getByRole('dialog', { name: 'Add patient' });
  await dlg.getByLabel('Full name').fill('Sample patient E2E');
  await dlg.getByLabel('Date of birth').fill('1978-03-14');
  await dlg.getByLabel('Sex').selectOption('F');
  await dlg.getByLabel('Family history of diabetes').selectOption('one');
  await noSeriousAxe(page);
  await expect(dlg.getByLabel(/gave their consent/)).toHaveAttribute('required', '');
  await dlg.getByLabel(/gave their consent/).check();
  await dlg.getByRole('button', { name: 'Add patient' }).click();
  await expect(page).toHaveURL(/\/measures$/);
  const patientUrl = page.url().replace(/\/measures$/, '');

  await page.getByRole('button', { name: 'Record baseline' }).click();
  const v = page.getByRole('dialog', { name: 'Record baseline' });
  for (const [l, val] of [['Weight (kg)', '72'], ['Height (cm)', '158'], ['Waist (cm)', '92'], ['Systolic (mmHg)', '138'], ['Diastolic (mmHg)', '88'], ['Fasting glucose (mg/dL)', '118'], ['HbA1c (%)', '6.1'], ['Total cholesterol (mg/dL)', '210'], ['HDL (mg/dL)', '44'], ['Triglycerides (mg/dL)', '180'], ['Creatinine (mg/dL)', '0.8']] as const)
    await v.getByLabel(l, { exact: true }).fill(val);
  await v.getByLabel(/brisk walking/).fill('60');
  await v.getByLabel(/Hours of sleep/).fill('6.5');
  await v.getByLabel(/Tobacco/).selectOption('never');
  await v.getByLabel(/Work and exercise/).selectOption('mild');
  await v.getByLabel('Weight (kg)', { exact: true }).fill('400');
  await v.getByRole('button', { name: 'Record visit' }).click();
  await expect(v.getByRole('alert')).toContainText('Weight 400 kg');
  await v.getByLabel('Weight (kg)', { exact: true }).fill('72');
  await v.getByRole('button', { name: 'Record visit' }).click();
  await expect(v).toBeHidden();
  await expect(page.getByRole('cell', { name: '28.8' })).toBeVisible(); // BMI 72 / 1.58²

  await page.getByRole('link', { name: 'Overview' }).click();
  await expect(page.getByRole('heading', { name: 'Health score' })).toBeVisible();
  await expect(page.getByText('Not calculated')).toBeVisible();
  await noSeriousAxe(page);
  await page.getByRole('button', { name: 'Record doctor clearance' }).click();
  await page.getByRole('dialog').getByLabel('Doctor’s name').fill('Dr Sample Doctor');
  await page.getByRole('dialog').getByRole('button', { name: 'Record doctor clearance' }).click();
  await page.getByRole('button', { name: 'Start programme' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Start the programme' }).click();
  await expect(page.getByText('In programme').first()).toBeVisible();

  await page.getByRole('link', { name: 'Plates' }).click();
  await page.getByRole('button', { name: 'Upload plate' }).click();
  const up = page.getByRole('dialog', { name: 'Upload plate' });
  await up.getByLabel('Meal').selectOption('Lunch');
  await up.getByLabel('Photo').setInputFiles(await photoFile(page));
  await expect(up.getByAltText('Preview of the plate photo')).toBeVisible();
  await up.getByRole('button', { name: 'Upload plate' }).click();
  await expect(page.getByText('Waiting for review')).toBeVisible();
  const img = page.getByAltText('Photo of lunch');
  await expect(img).toBeVisible();
  const src = await img.getAttribute('src');
  const res = await page.request.get(src!);
  expect(res.status()).toBe(200);
  expect((await res.body()).length).toBeLessThan(300_000);
  await signOut(page);
  expect((await page.request.get(src!)).status()).toBe(404); // no session, no photo

  // Nutritionist: review the plate and the week.
  await signIn(page, 'nutritionist', 'Meera (Good Food Guru)');
  await page.goto(`${patientUrl}/plates`);
  await page.getByRole('button', { name: 'Review plate' }).click();
  const rv = page.getByRole('dialog', { name: 'Review plate' });
  await rv.getByLabel('Vegetables').check();
  await rv.getByLabel('Protein and pulses').check();
  await rv.getByLabel('Grains and millets').check();
  await rv.getByLabel('Too much oil').check();
  await expect(rv.getByText('Suggested from the tags: 8.')).toBeVisible();
  await expect(rv.getByRole('img', { name: /vegetables, protein and pulses, grains and millets/ })).toBeVisible();
  await rv.getByLabel('Comment for the patient').fill('Good balance. Less oil next time.');
  await rv.getByRole('button', { name: 'Save review' }).click();
  await expect(page.getByText('8 of 10')).toBeVisible();
  await page.getByRole('link', { name: 'Weekly audit' }).click();
  await page.getByLabel('Review', { exact: true }).fill('Good first day. Oil is the main thing to work on.');
  await page.getByLabel('Goals for next week').fill('Use one spoon of oil per curry. Walk after dinner.');
  await page.getByLabel(/Attended this week/).check();
  await page.getByRole('button', { name: 'Save review' }).click();
  await expect(page.getByText(/Last saved by Meera/)).toBeVisible();
  await noSeriousAxe(page);
  await signOut(page);

  // Clinic staff: week 3 visit, red flag, report, approval, summary.
  await signIn(page, 'rmclinic', 'Asha (front desk)');
  await page.goto(`${patientUrl}/measures`);
  await page.getByRole('button', { name: 'Record a visit' }).click();
  const w3 = page.getByRole('dialog', { name: 'Record a visit' });
  await w3.getByLabel('Weight (kg)', { exact: true }).fill('70.5');
  await w3.getByLabel('Waist (cm)', { exact: true }).fill('89');
  await w3.getByLabel('Systolic (mmHg)', { exact: true }).fill('164');
  await w3.getByLabel('Diastolic (mmHg)', { exact: true }).fill('92');
  await w3.getByLabel(/brisk walking/).fill('150');
  await w3.getByRole('button', { name: 'Record visit' }).click();
  await expect(w3).toBeHidden();
  await page.getByRole('link', { name: 'Overview' }).click();
  await expect(page.locator('main').getByRole('alert').first()).toContainText('Blood pressure 160/100 or higher');
  await page.getByLabel('Doctor told').fill('Dr Sample Doctor');
  await page.getByRole('button', { name: 'Acknowledge alert' }).click();
  await expect(page.getByRole('button', { name: 'Acknowledge alert' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Report' }).click();
  await page.getByRole('button', { name: 'Create report draft' }).click();
  await expect(page.getByText('Draft version 1')).toBeVisible();
  await expect(page.getByText('Progress report')).toBeVisible();
  await expect(page.getByText('Sample data')).toHaveCount(0); // added through the form, so not a sample
  await noSeriousAxe(page);
  await page.getByLabel('Next step chosen by the doctor').selectOption('12-week programme');
  await page.getByLabel('Doctor’s name').fill('Dr Sample Doctor');
  await page.getByLabel(/The doctor reviewed this report/).check();
  await page.getByRole('button', { name: 'Approve report' }).click();
  await expect(page.getByText('This version is locked.')).toBeVisible();
  await page.getByRole('link', { name: 'Patient summary' }).click();
  await expect(page.getByRole('heading', { name: 'What went well' })).toBeVisible();
  await expect(page.getByText('Use one spoon of oil per curry.')).toBeVisible();
  const text = (await page.locator('article').innerText()).toLowerCase();
  for (const banned of ['reverse', 'cure', 'longevity', 'biological age', 'remission']) expect(text).not.toContain(banned);
  await noSeriousAxe(page);
  await signOut(page);

  // Admin: the audit log shows who did it, with no clinical values.
  await signIn(page, 'admin');
  await page.goto('/admin/audit?account=rmclinic');
  await expect(page.getByRole('cell', { name: 'report_approved' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Asha (front desk)' }).first()).toBeVisible();
  const audit = await page.locator('table').innerText();
  expect(audit).not.toContain('Sample patient E2E');
  expect(audit).not.toContain('164');
});
