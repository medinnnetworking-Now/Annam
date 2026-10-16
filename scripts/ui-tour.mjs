// Walk through the Annam workflow in a browser, capture each screen, and lay them out as a PDF.
// Usage: pnpm build && node scripts/ui-tour.mjs [out.pdf]
// Starts its own server on port 3200 with a fresh database of synthetic sample patients.
import { spawn } from 'node:child_process';
import { createHmac, randomBytes, scryptSync } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const OUT = process.argv[2] ?? 'annam-ui-workflow.pdf';
const BASE = 'http://localhost:3200';
const PW = { rmclinic: 'tour-clinic', nutritionist: 'tour-nutritionist', admin: 'tour-admin' };
const TOTP = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

const hash = pw => { const s = randomBytes(16); return ['scrypt', 16384, 8, 1, s.toString('base64url'), scryptSync(pw, s, 32, { N: 16384, r: 8, p: 1 }).toString('base64url')].join('$'); };
const b32 = s => { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, v = 0; const o = []; for (const c of s) { v = (v << 5) | A.indexOf(c); bits += 5; if (bits >= 8) { o.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(o); };
const totp = () => { const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = createHmac('sha1', b32(TOTP)).update(c).digest(); const o = h[19] & 15; return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0'); };

// ---------- server ----------
try { await fetch(BASE + '/login'); console.error('Port 3200 is already in use; stop that server first.'); process.exit(1); } catch {}
rmSync('.data/tour', { recursive: true, force: true });
const server = spawn('pnpm', ['start', '-p', '3200'], {
  env: { ...process.env, ANNAM_PGLITE_DIR: '.data/tour', ANNAM_SEED_SAMPLES: 'true', ANNAM_CLINIC_PASSWORD_HASH: hash(PW.rmclinic), ANNAM_NUTRITIONIST_PASSWORD_HASH: hash(PW.nutritionist), ANNAM_ADMIN_PASSWORD_HASH: hash(PW.admin), ANNAM_ADMIN_TOTP_SECRET: TOTP },
  stdio: 'ignore', detached: true
});
const stop = () => { try { process.kill(-server.pid); } catch {} };
process.on('exit', stop);
process.on('uncaughtException', e => { console.error(e); stop(); process.exit(1); });
process.on('unhandledRejection', e => { console.error(e); stop(); process.exit(1); });
for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + '/login')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }

// ---------- capture ----------
const browser = await chromium.launch();
const shots = [];
const SCALE = 1.5;
let current;
const step = (title, who, lines) => { current = { title, who, lines, images: [] }; shots.push(current); };
const png = async (target, opts = {}) => (await target.screenshot({ animations: 'disabled', ...opts })).toString('base64');
const add = async (target, caption, opts) => current.images.push({ src: await png(target, opts), caption });
// Tall elements are cut into slices that fit a page.
async function addTall(page, locator, caption, slice = 1250) {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  const docTop = await page.evaluate(() => window.scrollY);
  const top = b.y + docTop;
  for (let y = 0, i = 0; y < b.height; y += slice, i++) {
    const h = Math.min(slice, b.height - y);
    current.images.push({ src: await png(page, { fullPage: true, clip: { x: b.x, y: top + y, width: b.width, height: h } }), caption: i ? `${caption} (continued)` : caption });
  }
}

async function context(viewport = { width: 1280, height: 900 }, mobile = false) {
  const c = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : SCALE, isMobile: mobile, hasTouch: mobile });
  // Screenshots: keep the top bar in the page flow and hide toasts, so neither lands on top of a capture.
  await c.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style'); st.textContent = 'header.top{position:static!important}.toast{display:none!important}'; document.head.appendChild(st);
  }));
  return c.newPage();
}
async function signIn(page, user, name) {
  await page.goto(BASE + '/login');
  await page.getByLabel('Username').fill(user);
  await page.getByLabel('Password').fill(PW[user]);
  await page.getByLabel('Your name').fill(name);
  if (user === 'admin') await page.getByLabel(/Admin code/).fill(totp());
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(u => !u.pathname.startsWith('/login'));
}
const open = async (page, name) => { await page.goto(BASE + '/patients'); await page.getByRole('link', { name: new RegExp(name) }).first().click(); await page.getByRole('heading', { level: 1, name }).waitFor(); return page.url(); };
const settle = page => page.waitForTimeout(400);

// 1. Sign in
let page = await context();
step('Sign in', 'Everyone', ['Three fixed logins: rmclinic (clinic staff), nutritionist, admin. No sign-up.', 'Each person also types their own name. It goes on every record and the audit log, because the logins are shared by a team.', 'Five wrong passwords lock the account for 15 minutes. The admin also needs a code from an authenticator app.']);
await page.goto(BASE + '/login');
await add(page.locator('main'), 'Sign-in page');

// 2. Patient list
await signIn(page, 'rmclinic', 'Asha (front desk)');
step('Patient list', 'RM Clinic staff', ['Rows, not cards: name and code, age and sex, referrer, programme day of 21, latest score, status chip, last plate.', 'Open red-flag alerts and plates waiting for review are flagged on the row.', 'Search filters as you type, by name or patient code.']);
await settle(page);
await add(page, 'Patients, as RM Clinic staff');

// 3. Walk-in: add patient with consent
step('Step 1: Walk-in, consent and safety questions', 'RM Clinic staff', ['Staff ask the patient each question and enter the answers.', 'Five safety questions (insulin or sulfonylurea, kidney disease, pregnancy, eating disorder, recent admission). Any tick marks the patient “not suitable” until a doctor and the clinical lead clear them.', 'The consent text is read to the patient. The patient cannot be added without the consent box ticked; the server and database refuse it too.', 'Records: patient, consent with text version, who recorded it and when.']);
await page.setViewportSize({ width: 1280, height: 1500 });
await page.getByRole('button', { name: 'Add patient' }).click();
const dlg = page.getByRole('dialog', { name: 'Add patient' });
await dlg.getByLabel('Full name').fill('Sample patient G');
await dlg.getByLabel('Date of birth').fill('1976-08-21');
await dlg.getByLabel('Sex').selectOption('F');
await dlg.getByLabel('Referred by').fill('Dr Sample Referrer, RM Clinic');
await dlg.getByLabel('Family history of diabetes').selectOption('one');
await dlg.getByLabel(/gave their consent/).check();
await settle(page);
await add(dlg, 'Add patient dialog, with safety questions and consent');
await dlg.getByRole('button', { name: 'Add patient' }).click();
await page.waitForURL(/\/measures$/);
const gUrl = page.url().replace(/\/measures$/, '');

// 4. Baseline
step('Step 2: Baseline measures and the patient’s answers', 'RM Clinic staff (or nutritionist)', ['Body measures, blood pressure, glucose, lipids, liver and kidney labs, with units on every field. BMI is calculated.', 'Asked of the patient: minutes of brisk activity a week, hours of sleep, tobacco (smoked or chewed), second-hand smoke, work and exercise type, diagnosed diabetes, blood pressure and cholesterol medicine (yes/no only, never advice).', 'Values outside the usual range need a second look and a tick before they save.', 'Records: the visit, then a score snapshot with the score version.']);
await page.getByRole('button', { name: 'Record baseline' }).click();
const v = page.getByRole('dialog', { name: 'Record baseline' });
for (const [l, val] of [['Weight (kg)', '74'], ['Height (cm)', '157'], ['Waist (cm)', '93'], ['Hip (cm)', '103'], ['Systolic (mmHg)', '136'], ['Diastolic (mmHg)', '86'], ['Fasting glucose (mg/dL)', '112'], ['Post-meal glucose (mg/dL)', '168'], ['HbA1c (%)', '6.2'], ['Total cholesterol (mg/dL)', '214'], ['LDL (mg/dL)', '136'], ['HDL (mg/dL)', '45'], ['Triglycerides (mg/dL)', '176'], ['AST (U/L)', '28'], ['ALT (U/L)', '36'], ['Platelets (10⁹/L)', '250'], ['Creatinine (mg/dL)', '0.8']]) await v.getByLabel(l, { exact: true }).fill(val);
await v.getByLabel(/brisk walking/).fill('45');
await v.getByLabel(/Hours of sleep/).fill('6');
await v.getByLabel(/Tobacco/).selectOption('never');
await v.getByLabel('Lives with someone who smokes indoors').selectOption('no');
await v.getByLabel(/Work and exercise/).selectOption('mild');
await v.getByLabel('A doctor has said they have diabetes').selectOption('no');
await v.getByLabel('Takes blood pressure medicine').selectOption('no');
await v.getByLabel('Takes cholesterol medicine').selectOption('no');
await page.setViewportSize({ width: 1280, height: 2700 });
await settle(page);
await add(v, 'Record baseline dialog: measures, then the questions asked of the patient');
await v.getByRole('button', { name: 'Record visit' }).click();
await v.waitFor({ state: 'hidden' });
await page.setViewportSize({ width: 1280, height: 900 });
await settle(page);
await add(page.locator('main'), 'Measures table: one column per visit, carried-forward values in brackets', { });

// 5. Score
step('Step 4: Health score and risk', 'Calculated by the system; read by everyone', ['Health score 0 to 100: the American Heart Association’s Life’s Essential 8, with WHO cut-offs for BMI in Asian populations. Four behaviours (diet, activity, tobacco, sleep) and four health factors (BMI, lipids, glucose, blood pressure).', 'Change since baseline compares only measures recorded both times.', 'Risk beside it: Indian Diabetes Risk Score, FIB-4, metabolic syndrome, waist-to-height ratio, eGFR. Cardiovascular risk stays “Not calculated” until the clinical lead picks a South Asia chart.', 'Status: See your doctor (red flag), Needs attention (score under 50 or falling), On track, or Not enough data.']);
await open(page, 'Sample patient A');
await settle(page);
await add(page.locator('main .grid2').first(), 'Overview of Sample patient A: score and risk');
await addTall(page, page.locator('main .stack'), 'Overview, continued: trends, adherence and enrolment');
current.images.splice(1, 1); // the first slice repeats the panel above

// 6. Clearance and start
step('Step 3: Doctor clearance and programme start', 'Doctor decides; RM Clinic staff record it', ['The doctor sets safety limits at the consult. Staff record the doctor’s name; patients flagged at triage also need the clinical lead.', 'Starting the programme sets day 1 of 21. Weeks follow this date, not the calendar.', 'Every state change is in the audit log with who, when and why.']);
await page.goto(gUrl);
await page.getByRole('button', { name: 'Record doctor clearance' }).click();
const cl = page.getByRole('dialog');
await cl.getByLabel('Doctor’s name').fill('Dr Sample Doctor');
await settle(page);
await add(cl, 'Record doctor clearance');
await cl.getByRole('button', { name: 'Record doctor clearance' }).click();
await cl.waitFor({ state: 'hidden' });
await page.getByRole('button', { name: 'Start programme' }).click();
await page.getByRole('dialog').getByRole('button', { name: 'Start the programme' }).click();
await page.getByRole('dialog').waitFor({ state: 'hidden' });
await settle(page);
await add(page.locator('section', { has: page.getByRole('heading', { name: 'Enrolment' }) }), 'Enrolment panel after clearance and start');

// 7. Upload plate
step('Step 5a: Daily plates', 'RM Clinic staff or nutritionist uploads; the patient shares the photo', ['Meal, date, time and a photo from the camera. The photo is resized on the phone (720 px), location data is removed, and it is stored privately: only signed-in staff can see it.', 'Plates can be added from the baseline (a typical day) until the report is approved.']);
await page.goto(gUrl + '/plates');
await page.getByRole('button', { name: 'Upload plate' }).click();
const up = page.getByRole('dialog', { name: 'Upload plate' });
await up.getByLabel('Meal').selectOption('Lunch');
const jpeg = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 900; const x = c.getContext('2d');
  x.fillStyle = '#efe6d2'; x.fillRect(0, 0, 1200, 900);
  const plate = (cx, cy, r, col) => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fillStyle = col; x.fill(); };
  plate(600, 450, 380, '#ffffff'); plate(600, 450, 340, '#f4f1ea');
  x.fillStyle = '#5f9a4a'; x.beginPath(); x.moveTo(600, 450); x.arc(600, 450, 330, Math.PI / 2, Math.PI * 1.5); x.fill();
  x.fillStyle = '#d9962f'; x.beginPath(); x.moveTo(600, 450); x.arc(600, 450, 330, Math.PI * 1.5, Math.PI * 2); x.fill();
  x.fillStyle = '#f3ecdc'; x.beginPath(); x.moveTo(600, 450); x.arc(600, 450, 330, 0, Math.PI / 2); x.fill();
  for (let i = 0; i < 60; i++) { x.fillStyle = 'rgba(255,255,255,.7)'; x.fillRect(640 + (i * 37) % 260, 470 + (i * 53) % 260, 14, 5); }
  return c.toDataURL('image/jpeg', 0.92).split(',')[1];
});
await up.getByLabel('Photo').setInputFiles({ name: 'lunch.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg, 'base64') });
await up.getByAltText('Preview of the plate photo').waitFor();
await settle(page);
await add(up, 'Upload plate, with the photo preview');
await up.getByRole('button', { name: 'Upload plate' }).click();
await up.waitFor({ state: 'hidden' });
await page.getByAltText('Photo of lunch').waitFor();
await settle(page);
await add(page.locator('main'), 'Plates for the day: waiting for review');

// 8. Review plate
step('Step 5b: Plate review', 'Nutritionist (Good Food Guru)', ['Tag food groups and flags. The plate graphic fills in as tags are chosen: half vegetables, a quarter protein and pulses, a quarter grains and millets, fruit and dairy on the side.', 'A suggested score follows the tags until the nutritionist moves the slider. The nutritionist decides; the score is never automatic.', 'A comment for the patient in plain words.']);
const np = await context();
await signIn(np, 'nutritionist', 'Meera (Good Food Guru)');
await np.goto(gUrl + '/plates');
await np.setViewportSize({ width: 1280, height: 1500 });
await np.getByRole('button', { name: 'Review plate' }).click();
const rv = np.getByRole('dialog', { name: 'Review plate' });
for (const t of ['Vegetables', 'Protein and pulses', 'Grains and millets']) await rv.getByLabel(t).check();
await rv.getByLabel('Too much oil').check();
await rv.getByLabel('Comment for the patient').fill('Good balance on the plate. Try one spoon of oil in the curry.');
await settle(np);
await add(rv, 'Review plate: tags, live plate graphic, suggested score and comment');
await rv.getByRole('button', { name: 'Save review' }).click();
await rv.waitFor({ state: 'hidden' });
await np.setViewportSize({ width: 1280, height: 900 });

// 9. Weekly audit
step('Step 5c: Weekly audit and check-ins', 'Nutritionist', ['One section per programme week: daily average plate scores, days logged and flag counts.', 'The nutritionist writes the weekly review and goals, and records whether the check-in session was attended.']);
await open(np, 'Sample patient B');
await np.getByRole('link', { name: 'Weekly audit' }).click();
await np.locator('.week').first().waitFor();
await settle(np);
await add(np.locator('.week').first(), 'Weekly audit, week 3 of Sample patient B');

// 10. Work queue
step('Work queue', 'Nutritionist and RM Clinic staff', ['What needs doing today: red flags first, then plates waiting for review (target within 24 hours), patients who have stopped logging, weeks without a review, and check-in visits due.']);
await np.goto(BASE + '/queue');
await settle(np);
await add(np, 'Work queue');

// 11. Red flag
step('Red flag: tell the doctor the same day', 'RM Clinic staff', ['Red flags (blood pressure 160/100 or higher, fasting glucose 250+ or below 70, FIB-4 above 2.67, eGFR below 30, triglycerides 1000+) raise an alert at once.', 'The alert shows on the patient and in the work queue until staff record which doctor was told.', 'Status becomes “See your doctor”, with the flag as the reason.']);
await open(page, 'Sample patient D');
await settle(page);
await add(page, 'Sample patient D: alert at the top, status “See your doctor”');
await page.locator('section', { has: page.getByRole('heading', { name: 'Enrolment' }) }).scrollIntoViewIfNeeded();
await add(page.locator('section', { has: page.getByRole('heading', { name: 'Enrolment' }) }), 'Acknowledge the alert with the doctor’s name');

// 12. Report
step('Steps 6 and 7: Week 3 visit and the report', 'System drafts; doctor decides; RM Clinic staff record the approval', ['At week 3 staff repeat weight, waist, blood pressure, glucose and triglycerides. HbA1c is carried forward; it changes at 12 weeks.', 'The draft shows baseline against week 3 for every measure, score and risk change, adherence, the nutritionist’s summary and red flags.', 'The doctor chooses the next step (12-week programme, condition track, maintenance, or back to the referring doctor). Staff record the doctor’s name and approval; the version is then locked and never changes.', 'Print or save as PDF; every print is logged.']);
await open(page, 'Sample patient B');
await page.getByRole('link', { name: 'Report' }).click();
await page.getByRole('button', { name: 'Create report draft' }).click();
await page.getByText('Draft version 1').waitFor().catch(async e => { await page.screenshot({ path: '.data/tour-fail.png', fullPage: true }); throw e; });
await page.getByLabel('Next step chosen by the doctor').selectOption('12-week programme');
await page.getByLabel('Doctor’s name').fill('Dr Sample Doctor');
await page.getByLabel(/The doctor reviewed this report/).check();
await settle(page);
await addTall(page, page.locator('article.report'), 'Report draft for Sample patient B, with the approval form');
await page.getByRole('button', { name: 'Approve report' }).click();
await page.getByText('This version is locked.').waitFor();

// 13. Summary
step('Patient summary', 'Printed for the patient after approval', ['Plain language: what went well, one or two goals, and what happens next.', 'Never uses “reverse”, “cure”, “longevity”, “biological age” or “remission”. Ends with: do not change any medicine without talking to your doctor.', 'All patient-facing words live in one file, ready for a Malayalam version.']);
await add(page.locator('.signbox'), 'Approved and locked');
await page.getByRole('link', { name: 'Patient summary' }).click();
await page.getByRole('heading', { name: 'What went well' }).waitFor();
await settle(page);
await add(page.locator('article.report'), 'Patient summary for Sample patient B');

// 14. Admin
step('Admin: cohort and audit log', 'Admin (two-factor sign-in)', ['Cohort totals only: enrolled, in programme, completed, average score change, days logged, check-ins. No names; any group under 5 patients is hidden.', 'Audit log: who did what and when, with record ids but never patient names or clinical values. Viewing and exporting it are logged too.', 'The admin cannot open patient records.']);
const ap = await context();
await signIn(ap, 'admin', 'Programme admin');
await settle(ap);
await add(ap, 'Cohort');
await ap.goto(BASE + '/admin/audit');
await settle(ap);
await add(ap, 'Audit log');

// 15. Phone
step('On a phone (390 px)', 'Clinic staff on the floor', ['The same app on a phone: rows stack, tabs scroll sideways, dialogs open as bottom sheets, and every button is at least 44 px tall.', 'Can be added to the home screen and opens like an app.']);
const mp = await context({ width: 390, height: 844 }, true);
await signIn(mp, 'rmclinic', 'Asha (front desk)');
await settle(mp);
const phone = [await png(mp)];
await open(mp, 'Sample patient A');
await settle(mp);
phone.push(await png(mp));
await mp.getByRole('link', { name: 'Plates' }).click();
await mp.getByRole('button', { name: 'Upload plate' }).click();
await settle(mp);
phone.push(await png(mp));
current.phone = phone;

await browser.close();

// Show the clearance step before the score step, as in the workflow.
const i3 = shots.findIndex(s => s.title.startsWith('Step 3')), i4 = shots.findIndex(s => s.title.startsWith('Step 4'));
if (i3 > i4) shots.splice(i4, 0, ...shots.splice(i3, 1));

// ---------- PDF ----------
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const flow = [
  ['1', 'Walk-in', 'Consent, safety questions', 'Clinic staff'],
  ['2', 'Baseline', 'Measures, labs, answers', 'Clinic staff'],
  ['3', 'Consult', 'Doctor clears; nutritionist onboards', 'Doctor, recorded by staff'],
  ['4', 'Score', 'Score, risk, status', 'System'],
  ['5', 'Three weeks', 'Plates, reviews, check-ins', 'Nutritionist'],
  ['6', 'Week 3 visit', 'Repeat measures, new score', 'Clinic staff'],
  ['7', 'Report', 'Doctor decides the next step and approves', 'Doctor, recorded by staff']
];
const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Annam: UI and workflow</title>
<style>
@page { size: A4; margin: 14mm 14mm 16mm; }
* { box-sizing: border-box; }
body { font-family: 'Hanken Grotesk', system-ui, sans-serif; color: #17251E; margin: 0; font-size: 10.5pt; line-height: 1.45; }
.page { page-break-after: always; }
.page:last-child { page-break-after: auto; }
h1 { font-size: 30pt; margin: 0; color: #183D2B; letter-spacing: -.01em; }
h2 { font-size: 17pt; margin: 0 0 3mm; color: #183D2B; }
.cover { height: 265mm; display: flex; flex-direction: column; justify-content: space-between; }
.band { background: #183D2B; color: #fff; border-radius: 6mm; padding: 14mm 12mm; }
.band .ml { font-family: 'Noto Serif Malayalam', serif; font-size: 40pt; line-height: 1; }
.band p { color: #BFD6C6; font-size: 13pt; margin: 4mm 0 0; }
.muted { color: #5B6B62; }
.who { display: inline-block; background: #E3EEE6; color: #183D2B; border-radius: 99px; padding: 1mm 3.5mm; font-weight: 600; font-size: 9.5pt; margin-bottom: 3mm; }
ul { margin: 0 0 4mm; padding-left: 5mm; } li { margin: 0 0 1.2mm; }
figure { margin: 0 0 5mm; break-inside: avoid; }
figure img { display: block; max-width: 100%; max-height: 205mm; margin: 0 auto; border: 0.3mm solid #D6E1D8; border-radius: 2mm; }
figcaption { font-size: 9pt; color: #5B6B62; margin-top: 1.5mm; text-align: center; }
.flow { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2mm; margin: 6mm 0; }
.flow div { border: 0.3mm solid #D6E1D8; border-radius: 3mm; padding: 3mm 2.5mm; position: relative; background: #F5F8F3; min-height: 44mm; }
.flow b { display: block; font-size: 18pt; color: #2E6B47; }
.flow .t { font-weight: 700; font-size: 10.5pt; display: block; margin: 1mm 0; }
.flow .d { font-size: 8.5pt; display: block; }
.flow .r { font-size: 8pt; color: #7A4E08; background: #FBEBD0; border-radius: 99px; padding: .5mm 2mm; display: inline-block; margin-top: 2mm; }
table { border-collapse: collapse; width: 100%; font-size: 9.5pt; margin: 3mm 0 6mm; }
th, td { text-align: left; border-bottom: 0.3mm solid #D6E1D8; padding: 2mm 2.5mm; vertical-align: top; }
th { color: #5B6B62; font-weight: 600; background: #FAFCF9; }
.phones { display: flex; gap: 5mm; justify-content: center; }
.phones img { width: 56mm; border: 0.3mm solid #D6E1D8; border-radius: 4mm; }
.note { border-left: 1.2mm solid #E3A03A; background: #FFFBF3; padding: 3mm 4mm; border-radius: 1.5mm; font-size: 9.5pt; }
</style>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600;700&family=Noto+Serif+Malayalam:wght@700&display=swap" rel="stylesheet"></head><body>
<section class="page cover">
  <div class="band"><div class="ml">അന്നം</div><h1 style="color:#fff;margin-top:3mm">Annam</h1><p>UI and workflow walkthrough</p></div>
  <div>
    <p style="font-size:13pt;max-width:150mm">Nutrition follow-up for clinics and labs: one patient profile for every plate, every measure and every report. RM Clinic staff enter the data after asking the patient; the Good Food Guru nutritionist reviews plates; the doctor decides.</p>
    <p class="note">Every screen in this document uses invented sample patients. Do not enter real patient information until the pilot checklist is signed off.</p>
  </div>
  <p class="muted">Medinn · RM Clinic · Good Food Guru · ${esc(today)}</p>
</section>
<section class="page">
  <h2>The workflow</h2>
  <p class="muted">Seven steps over three weeks, and who does each one.</p>
  <div class="flow">${flow.map(f => `<div><b>${f[0]}</b><span class="t">${f[1]}</span><span class="d">${f[2]}</span><span class="r">${f[3]}</span></div>`).join('')}</div>
  <h2 style="font-size:13pt">Enrolment states</h2>
  <p>Consented → Baseline recorded → Cleared by doctor → In programme → Check-in due (day 19) → Check-in recorded → Report draft → Next step chosen. Exits at any point: not suitable, withdrawn (consent withdrawn: data entry stops at once), paused.</p>
  <h2 style="font-size:13pt">Who can do what</h2>
  <table>
    <tr><th>Login</th><th>Can</th><th>Cannot</th></tr>
    <tr><td><b>rmclinic</b><br><span class="muted">RM Clinic staff</span></td><td>Add patients with consent, enter measures and the patient’s answers, upload plates, tell the doctor about red flags, record the doctor’s clearance, next step and approval, export a patient’s data, withdraw consent. Cohort totals.</td><td>Score plates, write weekly reviews, see the audit log.</td></tr>
    <tr><td><b>nutritionist</b><br><span class="muted">Good Food Guru</span></td><td>Review and score plates, write weekly reviews and goals, record check-ins, record visits, draft reports. Work queue.</td><td>Add patients, approve reports, see cohort or audit.</td></tr>
    <tr><td><b>admin</b><br><span class="muted">Medinn, with two-factor code</span></td><td>Cohort totals (no names, groups under 5 hidden), audit log and its export.</td><td>Open any patient record.</td></tr>
  </table>
  <p class="note">The software calculates and displays; it never decides and never gives medication advice. Doctors decide and approve, and staff record their decisions by name.</p>
</section>
${shots.map(s => `<section class="page">
  <h2>${esc(s.title)}</h2>
  <span class="who">${esc(s.who)}</span>
  <ul>${s.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
  ${s.images.map(i => `<figure><img src="data:image/png;base64,${i.src}" alt=""><figcaption>${esc(i.caption)}</figcaption></figure>`).join('')}
  ${s.phone ? `<div class="phones">${s.phone.map(p => `<img src="data:image/png;base64,${p}" alt="">`).join('')}</div><p class="muted" style="text-align:center;font-size:9pt">Patient list · overview · upload plate as a bottom sheet</p>` : ''}
</section>`).join('\n')}
</body></html>`;

mkdirSync('.data', { recursive: true });
writeFileSync('.data/ui-tour.html', html);
const pdfBrowser = await chromium.launch();
const pp = await pdfBrowser.newPage();
await pp.goto('file://' + process.cwd() + '/.data/ui-tour.html', { waitUntil: 'networkidle' });
await pp.pdf({ path: OUT, format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="font-size:8px;color:#5B6B62;width:100%;text-align:center">Annam · sample data only · <span class="pageNumber"></span> of <span class="totalPages"></span></div>', margin: { top: '14mm', bottom: '16mm', left: '14mm', right: '14mm' } });
await pdfBrowser.close();
stop();
console.log('Wrote', OUT, shots.length, 'sections');
