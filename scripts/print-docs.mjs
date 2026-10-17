// Print the field guide for staff and the Malayalam patient flyer as PDFs.
// Usage: node scripts/print-docs.mjs <out-dir>   (ANNAM_TOUR_FONTS_CSS: stylesheet with embedded fonts)
// Values mirror src/lib/measures.ts and src/lib/scoring/config.ts; update both together.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const OUT = process.argv[2] ?? '.data/docs';
const FONTS = process.env.ANNAM_TOUR_FONTS_CSS ? readFileSync(process.env.ANNAM_TOUR_FONTS_CSS, 'utf8') : '';
const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

const BASE_CSS = `
@page { size: A4; margin: 13mm 13mm 15mm; }
* { box-sizing: border-box; }
body { font-family: 'Hanken Grotesk', 'Noto Sans Malayalam', system-ui, sans-serif; color: #17251E; margin: 0; font-size: 10pt; line-height: 1.45; }
.ml, [lang=ml] { font-family: 'Noto Sans Malayalam', sans-serif; }
.mls { font-family: 'Noto Serif Malayalam', serif; }
h1 { font-size: 24pt; margin: 0; color: #183D2B; letter-spacing: -.01em; }
h2 { font-size: 14pt; margin: 4mm 0 1.5mm; color: #183D2B; break-after: avoid; }
h3 { font-size: 11pt; margin: 3mm 0 1mm; color: #183D2B; break-after: avoid; }
.muted { color: #5B6B62; }
.band { background: #183D2B; color: #fff; border-radius: 4mm; padding: 7mm 8mm; margin-bottom: 5mm; display: flex; justify-content: space-between; align-items: center; gap: 6mm; }
.band h1 { color: #fff; } .band p { color: #BFD6C6; margin: 1.5mm 0 0; }
table { border-collapse: collapse; width: 100%; font-size: 8.6pt; margin: 1mm 0 2.5mm; line-height: 1.38; }
th, td { text-align: left; border-bottom: 0.3mm solid #D6E1D8; padding: 1.2mm 2mm; vertical-align: top; }
th { color: #5B6B62; font-weight: 600; background: #FAFCF9; }
tr { break-inside: avoid; }
.req { display: inline-block; background: #183D2B; color: #fff; border-radius: 99px; padding: 0 2mm; font-size: 7.5pt; font-weight: 700; }
.opt { display: inline-block; background: #E3EEE6; color: #183D2B; border-radius: 99px; padding: 0 2mm; font-size: 7.5pt; font-weight: 600; }
.note { border-left: 1.2mm solid #E3A03A; background: #FFFBF3; padding: 2.5mm 3.5mm; border-radius: 1.5mm; font-size: 9pt; margin: 2mm 0 3mm; break-inside: avoid; }
.alert { border-left-color: #C2492F; background: #FDF3F0; }
.ask { font-size: 9pt; color: #183D2B; }
.page { page-break-after: always; } .page:last-child { page-break-after: auto; }
ul { margin: 0 0 2mm; padding-left: 5mm; } li { margin: 0 0 1mm; }
code { font-family: ui-monospace, Menlo, monospace; font-size: 8.5pt; }
`;

const plateSvg = (size = 150) => {
  const c = size / 2, r = size * 0.42, ri = r * 0.86;
  const arc = (a0, a1) => { const p = a => [c + ri * Math.cos(a * Math.PI / 180), c + ri * Math.sin(a * Math.PI / 180)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${c} ${c} L${x0.toFixed(1)} ${y0.toFixed(1)} A${ri} ${ri} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`; };
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${r}" fill="#fff" stroke="#D9D3C4" stroke-width="${size * 0.02}"/><path d="${arc(90, 270)}" fill="#7DB06B" stroke="#fff" stroke-width="2"/><path d="${arc(270, 360)}" fill="#E3A03A" stroke="#fff" stroke-width="2"/><path d="${arc(0, 90)}" fill="#E9DDC3" stroke="#fff" stroke-width="2"/><circle cx="${size * 0.84}" cy="${size * 0.13}" r="${size * 0.07}" fill="#D8553F" stroke="#fff" stroke-width="2"/><circle cx="${size * 0.95}" cy="${size * 0.13}" r="${size * 0.07}" fill="#CFE0F0" stroke="#fff" stroke-width="2"/></svg>`;
};
const mark = (size = 46) => `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="20" rx="19" ry="12" transform="rotate(-25 20 20)" fill="#5E9A55"/><circle cx="20" cy="20" r="10" fill="#fff"/><path d="M20 20 L20 10 A10 10 0 0 1 30 20 Z" fill="#E3A03A"/><path d="M20 20 L20 30 A10 10 0 0 1 10 20 A10 10 0 0 1 20 10 Z" fill="#7DB06B"/></svg>`;

// ---------------------------------------------------------------- Field guide
const field = (name, unit, req, how, range, feeds) => `<tr><td><b>${name}</b>${unit ? ` <span class="muted">${unit}</span>` : ''}<br>${req ? '<span class="req">Required</span>' : '<span class="opt">Optional</span>'}</td><td>${how}</td><td>${range}</td><td>${feeds}</td></tr>`;
const ask = (en, ml) => `<tr><td><b>${en[0]}</b><br><span class="opt">Optional</span></td><td>${en[1]}<div class="ask ml" lang="ml">“${ml}”</div></td><td>${en[2]}</td></tr>`;

const guide = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Annam: field guide for data entry</title><style>${FONTS}${BASE_CSS}</style></head><body>
<section class="page">
  <div class="band"><div><div class="mls" style="font-size:28pt;line-height:1">അന്നം</div><h1 style="margin-top:2mm">Field guide for data entry</h1><p>Every field in Annam: what it means, how to measure it, and what it is used for. For RM Clinic staff and anyone entering data.</p></div>${mark(64)}</div>
  <div class="note"><b>The golden rule: enter only what you have.</b> Only <b>name, sex, age (or date of birth) and consent</b> are required to register a patient, and <b>one value</b> is enough to save a visit. Empty fields are fine; you can add them at the next visit. The health score appears once 4 of its 8 parts are recorded.</div>
  <h2>1. Registering a patient</h2>
  <table>
    <tr><th style="width:24%">Field</th><th style="width:46%">How to fill it</th><th>Used for</th></tr>
    <tr><td><b>Full name</b><br><span class="req">Required</span></td><td>As the patient wants it written.</td><td>Finding the patient. Never shown on totals or the audit log.</td></tr>
    <tr><td><b>Sex</b><br><span class="req">Required</span></td><td>Female or male.</td><td>Waist limits, HDL limits, kidney function (eGFR), diabetes risk.</td></tr>
    <tr><td><b>Age</b> or <b>Date of birth</b><br><span class="req">Required: one of them</span></td><td>Age in years is enough. Date of birth is more exact if the patient knows it. Adults only (18+).</td><td>Diabetes risk (IDRS), liver score (FIB-4), kidney function.</td></tr>
    <tr><td><b>Referred by</b><br><span class="opt">Optional</span></td><td>Doctor’s name and clinic. Left empty, it becomes “RM Clinic”.</td><td>Shown on the report.</td></tr>
    <tr><td><b>Family history of diabetes</b><br><span class="opt">Optional</span></td><td>Neither parent / one parent / both parents. Leave “Not asked” if unknown.<div class="ask ml" lang="ml">“അച്ഛനോ അമ്മയ്ക്കോ പ്രമേഹമുണ്ടോ? ഒരാൾക്കോ, രണ്ടുപേർക്കുമോ?”</div></td><td>Diabetes risk (IDRS). Without it, IDRS shows “Needs data”.</td></tr>
    <tr><td><b>Consent</b><br><span class="req">Required</span></td><td>Read the consent text to the patient (in Malayalam if they prefer), then tick. The text version is saved with the record.</td><td>Nothing can be recorded without it. Withdrawal stops all new entries at once.</td></tr>
  </table>
  <h3>The 5 safety questions (tick any that apply)</h3>
  <p class="muted" style="margin:0 0 1.5mm">Any tick marks the patient <b>“Not suitable”</b> until a doctor <b>and</b> the clinical lead clear them. These are optional ticks, but always ask.</p>
  <table>
    <tr><th style="width:42%">Question</th><th>Ask in Malayalam</th></tr>
    <tr><td>Takes insulin, or a medicine that can cause low blood sugar (e.g. a sulfonylurea)</td><td class="ml" lang="ml">ഇൻസുലിനോ, പഞ്ചസാര വളരെ കുറയാൻ സാധ്യതയുള്ള പ്രമേഹ ഗുളികകളോ കഴിക്കുന്നുണ്ടോ?</td></tr>
    <tr><td>Has kidney disease</td><td class="ml" lang="ml">വൃക്കരോഗം ഉണ്ടോ?</td></tr>
    <tr><td>Is pregnant or breastfeeding</td><td class="ml" lang="ml">ഗർഭിണിയാണോ? മുലയൂട്ടുന്നുണ്ടോ?</td></tr>
    <tr><td>Has or had an eating disorder</td><td class="ml" lang="ml">ഭക്ഷണവുമായി ബന്ധപ്പെട്ട മാനസിക ബുദ്ധിമുട്ട് (ഈറ്റിംഗ് ഡിസോർഡർ) ഇപ്പോഴോ മുമ്പോ ഉണ്ടായിട്ടുണ്ടോ?</td></tr>
    <tr><td>Was admitted to hospital in the last 3 months</td><td class="ml" lang="ml">കഴിഞ്ഞ 3 മാസത്തിനിടെ ആശുപത്രിയിൽ അഡ്മിറ്റ് ആയിരുന്നോ?</td></tr>
  </table>
</section>

<section class="page">
  <h2>2. Measures at a visit</h2>
  <p class="muted" style="margin:0 0 1.5mm">All optional; enter what was measured. Values outside the usual range ask you to check and confirm. They can still be saved.</p>
  <table>
    <tr><th style="width:19%">Measure</th><th style="width:39%">How to measure</th><th style="width:15%">Usual range</th><th>Used for</th></tr>
    ${field('Weight', 'kg', 0, 'Light clothes, no shoes, after emptying the bladder if possible. To 0.1 kg.', '25–250', 'BMI, trends')}
    ${field('Height', 'cm', 0, 'No shoes, heels against the wall, looking straight ahead. Needed once; it carries forward.', '120–210', 'BMI, waist-to-height ratio')}
    ${field('Waist', 'cm', 0, 'Standing, at the end of a normal breath out. Tape level, snug but not tight, <b>midway between the lowest rib and the top of the hip bone</b> (WHO). Not over thick clothes.', '45–180', 'Diabetes risk, metabolic syndrome, waist-to-height ratio, trends')}
    ${field('Hip', 'cm', 0, 'Around the widest part of the buttocks, tape level.', '55–190', 'Shown on the record')}
    ${field('Blood pressure', 'mmHg', 0, 'Seated, back supported, feet flat, after <b>5 minutes’ rest</b>; no tea, coffee or smoking for 30 minutes. Right-size cuff on a bare upper arm at heart level. Take 2 readings 1–2 minutes apart and enter the average. <b>Enter both</b> systolic (top) and diastolic (bottom).', 'Sys 70–260<br>Dia 40–150', 'Score (blood pressure), metabolic syndrome, <b>red flag at 160/100 or higher</b>')}
    ${field('Fasting glucose', 'mg/dL', 0, 'After at least 8 hours without food (water is fine). If the lab gives mmol/L, multiply by 18.', '40–600', 'Score (glucose), metabolic syndrome, <b>red flag at 250+ or below 70</b>')}
    ${field('Post-meal glucose', 'mg/dL', 0, '2 hours after the start of a meal.', '40–700', 'Shown on the report and trends')}
    ${field('HbA1c', '%', 0, 'From the lab. Reflects about 3 months, so it is repeated at 12 weeks, not week 3. Annam carries it forward up to 120 days.', '3.5–18', 'Score (glucose), diabetes range')}
    ${field('Total cholesterol', 'mg/dL', 0, 'From the lab report.', '70–500', 'Score (blood lipids: total minus HDL)')}
    ${field('LDL', 'mg/dL', 0, 'From the lab report.', '20–400', 'Shown on the report')}
    ${field('HDL', 'mg/dL', 0, 'From the lab report.', '10–150', 'Score (blood lipids), metabolic syndrome')}
    ${field('Triglycerides', 'mg/dL', 0, 'From the lab report; fasting sample preferred.', '30–3000', 'Metabolic syndrome, <b>red flag at 1000+</b>')}
    ${field('AST, ALT', 'U/L', 0, 'From the liver function test (AST = SGOT, ALT = SGPT).', '5–1000', 'Liver score (FIB-4)')}
    ${field('Platelets', '10⁹/L', 0, 'From the blood count. <b>Convert lakhs:</b> 2.5 lakh/cumm = 250. 250,000/µL = 250.', '20–1000', 'Liver score (FIB-4)')}
    ${field('Creatinine', 'mg/dL', 0, 'From the kidney function test.', '0.2–15', 'Kidney function (eGFR), <b>red flag if eGFR below 30</b>')}
  </table>
  <div class="note">Lab values carry forward to later visits for up to 120 days. Weight, waist, hip and blood pressure must be measured at each visit. Height carries forward always.</div>
</section>

<section class="page">
  <h2>3. Questions to ask the patient</h2>
  <p class="muted" style="margin:0 0 1.5mm">Each answer completes one part of the health score. They carry forward for 30 days. Record medicines <b>only as yes or no</b>. Never advise on medicines.</p>
  <table>
    <tr><th style="width:24%">Field</th><th style="width:50%">What to record, and how to ask</th><th>Used for</th></tr>
    ${ask(['Activity, minutes a week', 'Minutes of <b>brisk walking or exercise</b> in a usual week (moderate or vigorous only, e.g. 30 min × 5 days = 150).', 'Score (physical activity). Target 150+.'], 'ഒരു സാധാരണ ആഴ്ചയിൽ ആകെ എത്ര മിനിറ്റ് വേഗത്തിൽ നടക്കുകയോ വ്യായാമം ചെയ്യുകയോ ചെയ്യാറുണ്ട്?')}
    ${ask(['Sleep, hours a night', 'Usual hours of sleep a night, to the half hour.', 'Score (sleep). Best 7–9 hours.'], 'സാധാരണ ഒരു രാത്രി എത്ര മണിക്കൂർ ഉറങ്ങും?')}
    ${ask(['Tobacco', 'Smoked <b>or chewed</b> (beedi, cigarette, pan, gutka). Never / quit 5+ years / quit 1–5 years / quit under 1 year / uses now.', 'Score (tobacco exposure)'], 'പുകവലിക്കുകയോ മുറുക്കാൻ, പാൻ പോലുള്ള പുകയില ഉപയോഗിക്കുകയോ ചെയ്യാറുണ്ടോ? നിർത്തിയെങ്കിൽ എത്ര കാലമായി?')}
    ${ask(['Lives with an indoor smoker', 'Someone at home smokes indoors.', 'Score (tobacco exposure)'], 'വീട്ടിൽ ആരെങ്കിലും വീടിനുള്ളിൽ പുകവലിക്കാറുണ്ടോ?')}
    ${ask(['Work and exercise type', 'Vigorous / moderate / mild / mostly sitting.', 'Diabetes risk (IDRS)'], 'നിങ്ങളുടെ ജോലിയും വ്യായാമവും: കഠിനമാണോ, മിതമാണോ, ലഘുവാണോ, അതോ കൂടുതലും ഇരുന്നുള്ളതാണോ?')}
    ${ask(['Diagnosed diabetes', 'A doctor has said they have diabetes.', 'Score (glucose), metabolic syndrome'], 'പ്രമേഹമുണ്ടെന്ന് ഡോക്ടർ പറഞ്ഞിട്ടുണ്ടോ?')}
    ${ask(['Blood pressure medicine', 'Takes any medicine for blood pressure (yes/no).', 'Score (blood pressure), metabolic syndrome'], 'രക്തസമ്മർദ്ദത്തിന് മരുന്ന് കഴിക്കുന്നുണ്ടോ?')}
    ${ask(['Cholesterol medicine', 'Takes any medicine for cholesterol (yes/no).', 'Score (blood lipids)'], 'കൊളസ്ട്രോളിന് മരുന്ന് കഴിക്കുന്നുണ്ടോ?')}
  </table>
  <h2>4. Meal photos (plates)</h2>
  <table>
    <tr><th style="width:24%">Field</th><th>How to fill it</th></tr>
    <tr><td><b>Photo</b></td><td>From above, before eating, the whole plate in view. <b>No faces.</b> Annam shrinks it on the phone and removes location data.</td></tr>
    <tr><td><b>Meal, date, time</b></td><td>Filled in automatically from the clock; change them if the photo was sent later.</td></tr>
    <tr><td><b>Tags and flags</b> <span class="muted">(nutritionist)</span></td><td>Food groups: vegetables 4 points, protein and pulses 3, grains and millets 2, fruit 1, dairy 0. Flags subtract: too much oil 1.5, sweet drink or dessert 1.5, ultra-processed 2. The suggestion is rounded to 0–10; the nutritionist sets the final score.</td></tr>
  </table>
</section>

<section class="page">
  <h2>5. What Annam calculates</h2>
  <h3>Health score (0–100)</h3>
  <p style="margin:0 0 1.5mm">Based on the American Heart Association’s <b>Life’s Essential 8</b>, with WHO BMI cut-offs for Asian populations. Eight parts, each 0–100; the score is their average once at least 4 are recorded. <b>80+ high, 50–79 moderate, under 50 low.</b></p>
  <table>
    <tr><th style="width:22%">Part</th><th style="width:36%">Comes from</th><th>Full points</th></tr>
    <tr><td>Diet quality</td><td>Average reviewed plate score, last 7 days</td><td>Plate average 10 of 10</td></tr>
    <tr><td>Physical activity</td><td>Minutes a week</td><td>150 or more</td></tr>
    <tr><td>Tobacco exposure</td><td>Tobacco answer, indoor smoker</td><td>Never used, no smoke at home</td></tr>
    <tr><td>Sleep</td><td>Hours a night</td><td>7 to under 9</td></tr>
    <tr><td>Body mass index</td><td>Weight and height</td><td>Under 23 (Asian cut-offs: 23, 27.5, 32.5, 37.5)</td></tr>
    <tr><td>Blood lipids</td><td>Total cholesterol minus HDL (“non-HDL”)</td><td>Under 130 mg/dL; −20 if on cholesterol medicine</td></tr>
    <tr><td>Blood glucose</td><td>Fasting glucose, HbA1c, diagnosed diabetes</td><td>Fasting under 100 and HbA1c under 5.7</td></tr>
    <tr><td>Blood pressure</td><td>Both readings</td><td>Under 120/80; −20 if on BP medicine</td></tr>
  </table>
  <p class="muted" style="margin:0 0 2mm">Change since baseline compares only the parts recorded at both visits.</p>
  <h3>Risk tools</h3>
  <table>
    <tr><th style="width:26%">Tool</th><th style="width:38%">Needs</th><th>Reading it</th></tr>
    <tr><td>Indian Diabetes Risk Score</td><td>Age, waist, work/exercise type, family history</td><td>60+ high, 30–59 moderate, under 30 low</td></tr>
    <tr><td>FIB-4 (liver)</td><td>Age, AST, ALT, platelets</td><td>Under 1.3 low, above 2.67 high</td></tr>
    <tr><td>Metabolic syndrome</td><td>Waist, triglycerides, HDL, blood pressure, glucose</td><td>3 of 5 criteria = present</td></tr>
    <tr><td>Waist-to-height ratio</td><td>Waist, height</td><td>Under 0.5 healthy; 0.6+ high</td></tr>
    <tr><td>Kidney function (eGFR)</td><td>Creatinine, age, sex</td><td>60+ normal for age; under 30 is a red flag</td></tr>
    <tr><td>Cardiovascular risk</td><td colspan="2">Not calculated until the clinical lead chooses a chart validated for South Asia.</td></tr>
  </table>
  <h3>Red flags: tell the doctor the same day</h3>
  <div class="note alert">Blood pressure 160/100 or higher · Fasting glucose 250 mg/dL or higher, or below 70 · FIB-4 above 2.67 · eGFR below 30 · Triglycerides 1000 mg/dL or higher. Annam raises an alert; staff tell the doctor and acknowledge it with the doctor’s name.</div>
  <h3>Status</h3>
  <table>
    <tr><td style="width:26%"><b>See your doctor</b></td><td>Any red flag</td></tr>
    <tr><td><b>Not enough data</b></td><td>Fewer than 4 of 8 score parts</td></tr>
    <tr><td><b>Needs attention</b></td><td>Score under 50, or more than 5 points lower than the last visit</td></tr>
    <tr><td><b>On track</b></td><td>None of the above</td></tr>
  </table>
  <p class="muted" style="font-size:8.5pt;margin-top:4mm">Score version 2026.10-le8-sa.1. All thresholds are drafts, to be signed off by the clinical lead. Annam supports the care team; it does not diagnose, and the doctor decides on treatment. Annam by Medinn · first client RM Clinic · ${today}.</p>
</section>
</body></html>`;

// ---------------------------------------------------------------- Quick guide (2 pages)
const SITE = process.env.ANNAM_TOUR_LOGIN_URL ?? 'https://annam-medinn.vercel.app';
const qstep = (n, title, body) => `<div class="qs"><b>${n}</b><div><span class="t">${title}</span>${body}</div></div>`;
const quickGuide = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Annam: quick guide</title><style>${FONTS}${BASE_CSS}
body { font-size: 9.5pt; }
.qs { display: grid; grid-template-columns: 9mm 1fr; gap: 2.5mm; padding: 2.2mm 0; border-bottom: 0.3mm solid #D6E1D8; break-inside: avoid; }
.qs > b { font-size: 16pt; color: #2E6B47; line-height: 1; }
.qs .t { display: block; font-weight: 700; font-size: 10.5pt; color: #183D2B; margin-bottom: .5mm; }
.tap { background: #E3EEE6; color: #183D2B; border-radius: 1.2mm; padding: 0 1.2mm; font-weight: 600; white-space: nowrap; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
.chip { display: inline-block; border-radius: 99px; padding: .3mm 2.5mm; font-weight: 600; font-size: 8.5pt; min-width: 26mm; text-align: center; }
</style></head><body>
<section class="page">
  <div class="band"><div><div class="mls" style="font-size:24pt;line-height:1">അന്നം</div><h1 style="margin-top:1.5mm;font-size:20pt">Quick guide</h1><p>Annam by Medinn · RM Clinic</p></div>
    <div style="text-align:right;font-size:9.5pt;color:#fff"><b>${esc(SITE)}</b><br>rmclinic · nutritionist · admin<br><span style="color:#BFD6C6">Passwords from Medinn</span></div></div>
  <p style="margin:0 0 1mm"><b>Sign in:</b> username, password, and <b>your own name</b> every time. 5 wrong tries lock it for 15 minutes. <b>Only name, sex, age and consent are required</b>; leave anything else empty if you don’t have it.</p>
  <h2>RM Clinic staff</h2>
  ${qstep(1, 'Walk-in: add the patient', '<span class="tap">Patients → Add patient</span>. Name, sex, age. Ask the 5 safety questions. Read the consent text, tick consent, <span class="tap">Add patient</span>.')}
  ${qstep(2, 'Baseline: record what was measured', '<span class="tap">Measures → Record baseline</span>. Weight, waist, BP, sugar on top; labs under <i>More lab values</i>. Ask: activity, sleep, tobacco, medicines (yes/no). One value is enough to save.')}
  ${qstep(3, 'After the doctor’s consult', '<span class="tap">Overview → Record doctor clearance</span> with the doctor’s name, then <span class="tap">Start programme</span>. Day 1 of 21.')}
  ${qstep(4, 'Every day for 3 weeks', '<span class="tap">Work queue</span>. <b>Red flags first: tell the doctor today</b>, then <span class="tap">Acknowledge alert</span> with the doctor’s name. Upload meal photos patients send: <span class="tap">Plates → Upload plate</span> (no faces).')}
  ${qstep(5, 'Day 19 to 21: week 3 visit', '<span class="tap">Measures → Record a visit → Week 3 check-in</span>. Weight, waist, BP, fasting and post-meal sugar, triglycerides.')}
  ${qstep(6, 'Report and approval', '<span class="tap">Report → Create report draft</span>. The doctor decides the next step. Choose it, type the doctor’s name, tick, <span class="tap">Approve report</span>. Print the <span class="tap">Patient summary</span>.')}
  ${qstep(7, 'If the patient wants to leave', '<span class="tap">Export patient data</span> (offer a copy), then <span class="tap">Withdraw consent</span>.')}
  <h2>Measuring right</h2>
  <div class="cols" style="font-size:9pt">
    <ul>
      <li><b>Waist:</b> midway between lowest rib and top of hip bone, after breathing out.</li>
      <li><b>BP:</b> seated, 5 min rest, 2 readings, enter the average. Both numbers.</li>
      <li><b>Fasting sugar:</b> 8+ hours without food. mmol/L × 18 = mg/dL.</li>
    </ul>
    <ul>
      <li><b>Platelets:</b> 2.5 lakh = <b>250</b>.</li>
      <li><b>Height:</b> once is enough; it carries forward.</li>
      <li><b>HbA1c:</b> at baseline and 12 weeks, not week 3.</li>
    </ul>
  </div>
</section>
<section class="page">
  <div class="cols">
    <div>
      <h2 style="margin-top:0">Nutritionist</h2>
      ${qstep('1', 'Review plates daily', '<span class="tap">Work queue</span> → <span class="tap">Review plate</span>. Tick food groups and flags; a score is suggested. Move the slider to set yours. Short comment in plain words.')}
      ${qstep('2', 'Weekly review', '<span class="tap">Weekly audit</span>: review, next week’s goals, tick if the check-in was attended.')}
      <p style="font-size:9pt">Never give medicine advice.</p>
      <h2>Admin (with 6-digit code)</h2>
      <ul style="font-size:9pt">
        <li><b>Cohort:</b> totals only, no names.</li>
        <li><b>Audit log:</b> who did what; export CSV.</li>
        <li>Health check: <code>${esc(SITE)}/api/health</code></li>
      </ul>
    </div>
    <div>
      <h2 style="margin-top:0">The plate</h2>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:3mm;align-items:center;font-size:9pt">${plateSvg(95)}
        <div>½ vegetables<br>¼ protein and pulses<br>¼ grains and millets<br>+ fruit and dairy</div></div>
      <h2>Status colours</h2>
      <table>
        <tr><td><span class="chip" style="background:#E3EEE6;color:#183D2B">On track</span></td><td>All fine</td></tr>
        <tr><td><span class="chip" style="background:#FBEBD0;color:#7A4E08">Needs attention</span></td><td>Score under 50 or falling</td></tr>
        <tr><td><span class="chip" style="background:#F7DDD6;color:#8A2B18">See your doctor</span></td><td>Red flag: tell the doctor today</td></tr>
        <tr><td><span class="chip" style="background:#F1F3F1;color:#5B6B62">Not enough data</span></td><td>Fewer than 4 of 8 score parts</td></tr>
      </table>
    </div>
  </div>
  <h2>Red flags: tell the doctor the same day</h2>
  <div class="note alert" style="font-size:9.5pt">BP <b>160/100</b> or higher · Fasting sugar <b>250+</b> or <b>below 70</b> · FIB-4 above 2.67 · eGFR below 30 · Triglycerides 1000+</div>
  <h2>If something goes wrong</h2>
  <table>
    <tr><td style="width:42%"><b>“Username and password do not match”</b></td><td>Check capital letters; copy-paste the password.</td></tr>
    <tr><td><b>“Account is locked”</b></td><td>Wait 15 minutes.</td></tr>
    <tr><td><b>“Something went wrong”</b></td><td>Tap Try again. If it repeats, tell the admin what you were doing.</td></tr>
    <tr><td><b>Red box on the sign-in page</b></td><td>Server settings need attention. Tell the admin.</td></tr>
  </table>
  <h2>Rules</h2>
  <ul>
    <li>Your own name, every time. Never share passwords outside your team.</li>
    <li>No faces in photos. Medicines only as yes/no. Never medicine advice.</li>
    <li>Annam calculates; <b>the doctor decides</b>. Nothing is approved without the doctor’s name.</li>
  </ul>
</section>
</body></html>`;

// ---------------------------------------------------------------- Malayalam patient flyer
const flyer = `<!doctype html><html lang="ml"><head><meta charset="utf-8"><title>അന്നം: രോഗികൾക്കുള്ള വിവരപത്രം</title><style>${FONTS}${BASE_CSS}
body { font-family: 'Noto Sans Malayalam', 'Hanken Grotesk', sans-serif; font-size: 9.5pt; line-height: 1.5; }
h1 { font-family: 'Noto Serif Malayalam', serif; font-size: 28pt; line-height: 1.1; }
h2 { font-size: 11.5pt; margin: 3mm 0 1mm; }
.band { padding: 5mm 7mm; margin-bottom: 3mm; }
.steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2mm; margin: 2mm 0 1mm; }
.steps div { background: #F5F8F3; border: 0.3mm solid #D6E1D8; border-radius: 3mm; padding: 2mm; font-size: 8.3pt; line-height: 1.4; }
.steps b { display: block; font-size: 15pt; color: #2E6B47; line-height: 1.1; }
.steps .t { font-weight: 700; display: block; margin: .5mm 0; font-size: 8.8pt; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
.box { border: 0.3mm solid #D6E1D8; border-radius: 3mm; padding: 2.5mm 3.5mm; break-inside: avoid; }
.box ul { font-size: 8.8pt !important; margin: 0; } .box li { margin: 0 0 .6mm; }
.platebox { display: grid; grid-template-columns: auto 1fr; gap: 4mm; align-items: center; }
.key { display: inline-block; width: 3mm; height: 3mm; border-radius: 1mm; margin-right: 1.5mm; vertical-align: middle; }
.fill { display: inline-block; min-width: 55mm; border-bottom: 0.3mm solid #17251E; }
.en { font-family: 'Hanken Grotesk', sans-serif; }
</style></head><body>
<div class="band">
  <div><h1>അന്നം</h1><p style="font-size:12.5pt;color:#fff;margin-top:2mm">നല്ല ഭക്ഷണത്തിലൂടെ ആരോഗ്യത്തിലേക്ക്: മൂന്ന് ആഴ്ചത്തെ ഭക്ഷണ പിന്തുണാ പരിപാടി</p>
  <p class="en" style="font-size:9pt">Annam by Medinn · RM Clinic · Good Food Guru</p></div>${mark(58)}
</div>
<h2 style="margin-top:0">അന്നം എന്താണ്?</h2>
<p style="margin:0">പ്രമേഹം, രക്തസമ്മർദ്ദം, ഫാറ്റി ലിവർ പോലുള്ള ജീവിതശൈലീ രോഗങ്ങൾ നിയന്ത്രിക്കാൻ <b>സഹായിക്കുന്ന</b> ഒരു ഭക്ഷണ പിന്തുണാ പരിപാടിയാണ് അന്നം. മൂന്ന് ആഴ്ച നിങ്ങൾ കഴിക്കുന്ന ഓരോ ഭക്ഷണത്തിന്റെയും ഫോട്ടോ ക്ലിനിക്കിലേക്ക് അയയ്ക്കുന്നു. ഞങ്ങളുടെ ന്യൂട്രീഷനിസ്റ്റ് ഓരോ പ്ലേറ്റും നോക്കി നിങ്ങൾക്ക് ലളിതമായ നിർദ്ദേശങ്ങൾ തരും. അവസാനം നിങ്ങളുടെ പുരോഗതി ഡോക്ടർ പരിശോധിക്കും.</p>
<h2>എങ്ങനെയാണ് നടക്കുന്നത്?</h2>
<div class="steps">
  <div><b>1</b><span class="t">ആദ്യ സന്ദർശനം</span>ഭാരം, അരവണ്ണം, രക്തസമ്മർദ്ദം, രക്തപരിശോധന. നിങ്ങളുടെ സമ്മതം രേഖപ്പെടുത്തും.</div>
  <div><b>2</b><span class="t">ഡോക്ടറെ കാണൽ</span>ഈ പരിപാടി നിങ്ങൾക്ക് സുരക്ഷിതമാണെന്ന് ഡോക്ടർ ഉറപ്പാക്കും.</div>
  <div><b>3</b><span class="t">മൂന്ന് ആഴ്ച</span>ഓരോ ഭക്ഷണത്തിന്റെയും ഫോട്ടോ അയയ്ക്കുക. ആഴ്ചയിൽ ഒരിക്കൽ ന്യൂട്രീഷനിസ്റ്റുമായി സംസാരം.</div>
  <div><b>4</b><span class="t">മൂന്നാം ആഴ്ചയിലെ സന്ദർശനം</span>അളവുകൾ വീണ്ടും എടുക്കും.</div>
  <div><b>5</b><span class="t">റിപ്പോർട്ട്</span>ഡോക്ടർ പുരോഗതി നോക്കി അടുത്ത ഘട്ടം തീരുമാനിക്കും. നിങ്ങൾക്ക് ഒരു ചെറിയ സംഗ്രഹം ലഭിക്കും.</div>
</div>
<div class="two" style="margin-top:3mm">
  <div class="box">
    <h2 style="margin-top:0">സമീകൃത പ്ലേറ്റ്</h2>
    <div class="platebox">${plateSvg(100)}
      <div style="font-size:8.8pt;line-height:1.5">
        <div><span class="key" style="background:#7DB06B"></span><b>പകുതി:</b> പച്ചക്കറികൾ (തോരൻ, അവിയൽ, സാലഡ്)</div>
        <div><span class="key" style="background:#E3A03A"></span><b>കാൽ ഭാഗം:</b> പയർ, പരിപ്പ്, മീൻ, മുട്ട, ചിക്കൻ</div>
        <div><span class="key" style="background:#E9DDC3;border:0.2mm solid #cbbf9f"></span><b>കാൽ ഭാഗം:</b> ചോറ്, ചപ്പാത്തി, ചെറുധാന്യങ്ങൾ</div>
        <div><span class="key" style="background:#D8553F"></span><span class="key" style="background:#CFE0F0"></span>കൂടെ ഒരു പഴവും മോര്/തൈരും</div>
      </div>
    </div>
  </div>
  <div class="box">
    <h2 style="margin-top:0">ഫോട്ടോ എടുക്കുമ്പോൾ</h2>
    <ul style="font-size:9.5pt">
      <li>കഴിക്കുന്നതിന് <b>മുമ്പ്</b>, പ്ലേറ്റിന്റെ <b>മുകളിൽ നിന്ന്</b> ഫോട്ടോ എടുക്കുക.</li>
      <li>എല്ലാ ഭക്ഷണവും: പ്രഭാതഭക്ഷണം, ഉച്ചഭക്ഷണം, ലഘുഭക്ഷണം, അത്താഴം.</li>
      <li>ചായ, ജ്യൂസ്, മധുരപലഹാരങ്ങൾ എന്നിവയും ഉൾപ്പെടുത്തുക.</li>
      <li>ഫോട്ടോയിൽ <b>മുഖങ്ങൾ വരരുത്</b>.</li>
    </ul>
  </div>
</div>
<div class="two" style="margin-top:3mm">
  <div class="box" style="border-color:#E8B4A6;background:#FDF6F3">
    <h2 style="margin-top:0;color:#8A2B18">ശ്രദ്ധിക്കുക</h2>
    <ul style="font-size:9.5pt">
      <li>ഡോക്ടറോട് ചോദിക്കാതെ <b>മരുന്നുകൾ നിർത്തുകയോ മാറ്റുകയോ ചെയ്യരുത്</b>.</li>
      <li>തലകറക്കം, വിറയൽ, അമിതമായ വിയർപ്പ്, നെഞ്ചുവേദന പോലുള്ള ബുദ്ധിമുട്ടുകൾ ഉണ്ടായാൽ <b>ഉടൻ ഡോക്ടറെ കാണുക</b>.</li>
      <li>അന്നം ഡോക്ടറുടെ ചികിത്സയ്ക്ക് പകരമല്ല; അതിന് ഒരു പിന്തുണ മാത്രമാണ്.</li>
    </ul>
  </div>
  <div class="box">
    <h2 style="margin-top:0">നിങ്ങളുടെ വിവരങ്ങൾ</h2>
    <ul style="font-size:9.5pt">
      <li>ക്ലിനിക് ടീമിനും ന്യൂട്രീഷനിസ്റ്റിനും മാത്രമേ കാണാനാകൂ; ഇന്ത്യയിൽ സുരക്ഷിതമായി സൂക്ഷിക്കുന്നു.</li>
      <li>നിങ്ങളുടെ വിവരങ്ങൾ വിൽക്കുകയോ പരസ്യത്തിന് ഉപയോഗിക്കുകയോ ഇല്ല.</li>
      <li>വിവരങ്ങളുടെ പകർപ്പ് ചോദിക്കാം; എപ്പോൾ വേണമെങ്കിലും പരിപാടിയിൽ നിന്ന് പിന്മാറാം.</li>
    </ul>
  </div>
</div>
<div class="box" style="margin-top:3mm;background:#F5F8F3">
  <h2 style="margin-top:0">ഫോട്ടോകൾ അയയ്ക്കേണ്ടത് / സംശയങ്ങൾക്ക്</h2>
  <p style="margin:0">RM ക്ലിനിക് വാട്‌സ്ആപ്പ്: <span class="fill">&nbsp;</span> &nbsp; ഫോൺ: <span class="fill">&nbsp;</span></p>
  <p style="margin:2mm 0 0">എന്റെ പരിപാടി തുടങ്ങുന്ന തീയതി: <span class="fill">&nbsp;</span> &nbsp; മൂന്നാം ആഴ്ചയിലെ സന്ദർശനം: <span class="fill">&nbsp;</span></p>
</div>
<p class="muted en" style="font-size:7.5pt;margin:2mm 0 0">Annam by Medinn · RM Clinic · Good Food Guru · Supports care; does not replace medical advice.</p>
</body></html>`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const [name, html, footer, scale] of [
  ['Annam-field-guide.pdf', guide, 'Annam by Medinn · Field guide for data entry', 1],
  ['Annam-patient-flyer-Malayalam.pdf', flyer, null, 0.93], // the flyer must fit one printed sheet
  ['Annam-quick-guide.pdf', quickGuide, 'Annam by Medinn · Quick guide', 1]
]) {
  const file = join(OUT, name.replace('.pdf', '.html'));
  writeFileSync(file, html);
  const page = await browser.newPage();
  await page.goto('file://' + (file.startsWith('/') ? file : process.cwd() + '/' + file), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: join(OUT, name), format: 'A4', printBackground: true, scale,
    displayHeaderFooter: !!footer, headerTemplate: '<span></span>',
    footerTemplate: footer ? `<div style="font-size:8px;color:#5B6B62;width:100%;text-align:center">${footer} · <span class="pageNumber"></span> of <span class="totalPages"></span></div>` : '<span></span>',
    margin: { top: footer ? '13mm' : '10mm', bottom: footer ? '15mm' : '8mm', left: '13mm', right: '13mm' }
  });
  console.log('Wrote', join(OUT, name));
}
await browser.close();
