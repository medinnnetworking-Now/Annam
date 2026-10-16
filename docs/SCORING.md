# Annam: score, risk and status

Status: **draft, to be signed off by the clinical lead.** Version `2026.10-le8-sa.1`. Every number below lives in
`src/lib/scoring/config.ts`; every saved score records its version in `score_snapshots.score_version`, and snapshots
saved under an older version are never recalculated. Tests: `src/lib/scoring/index.test.ts`.

## Why this score
The kit's draft score (metabolic 40, body 20, diet 25, behaviour 15) was home-grown. It also scored a patient with
perfect labs at 80 on day 1, because behaviour points can't be earned before the programme starts. Annam now uses
an internationally published, validated framework instead:

**American Heart Association, Life's Essential 8** (Lloyd-Jones et al., *Circulation* 2022;146:e18–e43): eight
components, each scored 0 to 100, averaged into one score. Higher LE8 scores are associated with lower
cardiovascular disease, diabetes and mortality risk in large cohorts, including outside the USA.

One adaptation for South Asian patients: **BMI uses the WHO public health action points for Asian populations**
(WHO Expert Consultation, *Lancet* 2004;363:157–63): 23, 27.5, 32.5 and 37.5 instead of 25, 30, 35 and 40.

## Components (each 0 to 100)
| Component | Source in Annam | Points |
| --- | --- | --- |
| Diet | Average reviewed plate score over the 7 days up to the visit, × 10 | 0 to 100 (LE8 uses a diet questionnaire; this is an Annam substitute) |
| Physical activity | Minutes of moderate or vigorous activity a week, asked | ≥150: 100 · 120–149: 90 · 90–119: 80 · 60–89: 60 · 30–59: 40 · 1–29: 20 · 0: 0 |
| Tobacco | Smoked **or smokeless** tobacco, asked | Never 100 · quit ≥5 y 75 · quit 1–5 y 50 · quit <1 y 25 · current 0 · −20 if they live with an indoor smoker (not for current users) |
| Sleep | Average hours a night, asked | 7–<9: 100 · 9–<10: 90 · 6–<7: 70 · 5–<6 or ≥10: 40 · 4–<5: 20 · <4: 0 |
| BMI | Weight and height | <23: 100 · 23–27.4: 70 · 27.5–32.4: 30 · 32.5–37.4: 15 · ≥37.5: 0 (BMI under 18.5 shows a note) |
| Blood lipids | Non-HDL cholesterol = total − HDL, mg/dL | <130: 100 · 130–159: 60 · 160–189: 40 · 190–219: 20 · ≥220: 0 · −20 if on cholesterol medicine |
| Blood glucose | Fasting glucose and HbA1c, plus "diagnosed diabetes" | No diabetes: normal 100, prediabetes (FPG 100–125 or HbA1c 5.7–6.4) 60. Diabetes (diagnosed, FPG ≥126 or HbA1c ≥6.5), by HbA1c: <7: 40 · 7–7.9: 30 · 8–8.9: 20 · 9–9.9: 10 · ≥10: 0 |
| Blood pressure | Both values, mmHg; the worse band applies | <120/<80: 100 · 120–129/<80: 75 · 130–139 or 80–89: 50 · 140–159 or 90–99: 25 · ≥160 or ≥100: 0 · −20 if on blood pressure medicine |

**Health score** = the average of the components measured, rounded. It is shown only when **at least 4 of 8** are
measured; otherwise the status reads "Not enough data". Categories: **High ≥80, Moderate 50–79, Low <50** (LE8).

## Fair comparisons
- **Change since baseline** (and since the previous visit) uses only components measured **at both visits**, so a part
  that appears or disappears (diet at baseline, for example) can't move the number. Needs at least 4 shared parts.
- **Carrying values forward**: labs (HbA1c, lipids, glucose, liver, platelets, creatinine) carry forward up to 120 days;
  lifestyle answers and medicines up to 30 days; height always; weight, waist, hip and blood pressure never. So the
  week 3 visit, which doesn't repeat HbA1c, still has a glucose score. Carried values are shown in brackets.
- When two visits fall on the same day, the one recorded later wins.

## Risk tools (shown beside the score, not part of it)
| Tool | Reference | Bands |
| --- | --- | --- |
| Indian Diabetes Risk Score | Mohan et al., *JAPI* 2005 | Age <35: 0, 35–49: 20, ≥50: 30. Waist (F <80, 80–89, ≥90; M <90, 90–99, ≥100): 0, 10, 20. Activity vigorous 0, moderate 10, mild 20, sedentary 30. Family history none 0, one parent 10, both 20. ≥60 High, 30–59 Moderate, <30 Low |
| FIB-4 | Sterling et al., *Hepatology* 2006 | (age × AST) ÷ (platelets × √ALT). <1.3 Low, 1.3–2.67 Indeterminate, >2.67 High. Caution under 35 or over 65 |
| Metabolic syndrome | Alberti et al., *Circulation* 2009 (harmonised), South Asian waist | 3 or more of: waist ≥90 M / ≥80 F; TG ≥150; HDL <40 M / <50 F; BP ≥130/85 or treated; FPG ≥100 or diabetes |
| Waist-to-height ratio | NICE NG246 | <0.5 Low, 0.5–0.59 Increased, ≥0.6 High |
| eGFR | CKD-EPI 2021, race-free (Inker et al., *NEJM* 2021); KDIGO stages | G1 ≥90 · G2 60–89 · G3a 45–59 · G3b 30–44 · G4 15–29 · G5 <15 |
| Cardiovascular risk | — | **Not calculated** until the clinical lead chooses a chart validated for South Asia (the WHO 2019 South Asia chart is a candidate) |

## Red flags (alert the doctor the same day). To confirm with the clinical lead.
- Blood pressure 160/100 or higher (either value)
- Fasting glucose 250 mg/dL or higher, or below 70 mg/dL (ADA level 1 hypoglycaemia)
- FIB-4 above 2.67
- eGFR below 30 (KDIGO G4 or worse) *(new)*
- Triglycerides 1000 mg/dL or higher (Endocrine Society: pancreatitis risk) *(new)*

A red flag creates an alert. Clinic staff tell the doctor and acknowledge the alert with the doctor's name.

## Status
1. Any red flag: **See your doctor**, with the flags as the reason.
2. No score (fewer than 4 parts): **Not enough data**.
3. Score below 50, or more than 5 points lower than the previous visit on comparable parts: **Needs attention**.
4. Otherwise: **On track**.

## Programme adherence (reported, not scored)
Days with a plate out of days elapsed (capped at 21, plates outside the programme window ignored), plates reviewed,
and check-ins attended out of **completed** weeks, so nobody is marked down on day 1.

## Plate score suggestion (unchanged)
Vegetables 4, protein and pulses 3, grains and millets 2, fruit 1, dairy 0. Subtract 1.5 for too much oil, 1.5 for a
sweet drink or dessert, 2 for ultra-processed. Round and clamp 0 to 10. A suggestion only; the nutritionist decides.

## Worked example: Sample patient A at baseline
Diet not yet measured; activity 60 min → 60; never used tobacco → 100; sleep 6.5 h → 70; BMI 27.6 → 30;
non-HDL 174 → 40; FPG 138 and HbA1c 7.1 (diabetes range) → 30; BP 142/90 → 25.
7 of 8 measured; (60+100+70+30+40+30+25) ÷ 7 = 50.7 → **51, Moderate**. IDRS 60 High; FIB-4 1.03 Low; metabolic
syndrome present (5 of 5); WHtR 0.58 Increased; eGFR 106 (G1). No red flags → **On track**.
