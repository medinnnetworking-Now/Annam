# Annam: product requirements

## Problem
Lifestyle-related conditions such as type 2 diabetes, hypertension and fatty liver are common in Kerala clinics. Patients leave a consult with advice but little structure. Doctors rarely see what happens between visits. Nutritionists work from scattered photos and chats.

## Product
One patient profile that follows a structured programme: baseline, three weeks of plate-by-plate accountability, a check-in visit, a recalculated score, and a report for the referring doctor.

## Users and what they need
| User | Needs to |
| --- | --- |
| Patient | Upload a plate in a few taps, see feedback and goals, see progress in plain language |
| Nutritionist | See every plate, tag and score it quickly, write a weekly review, track who is falling behind |
| Doctor | See baseline against follow-up, the score and risk, red flags, and approve a report |
| Clinic staff | Register a patient, capture consent, enter anthropometry and lab values |
| Programme lead | See cohort results: enrolment, completion, average score change, cost per patient |

## Features, with acceptance criteria

### 1. Patients and consent
- Clinic staff or a nutritionist can add a patient with name, age, sex, referrer, programme start, family history of diabetes and activity level.
- A patient cannot be added without recorded consent. Consent stores the version of the consent text, who recorded it and when.
- The patient list shows name, programme day, score, status and last plate date, with search.

### 2. Measures
- A visit records date, label (Baseline, Week 3 check-in, Week 12 follow-up, Other) and any of: weight, height, waist, hip, systolic and diastolic pressure, fasting and post-meal glucose, HbA1c, total cholesterol, LDL, HDL, triglycerides, AST, ALT, platelets, creatinine.
- BMI is calculated, not entered.
- Values outside plausible ranges show a warning and need confirmation, but can be saved.
- A visit needs at least one of weight, waist, blood pressure or fasting glucose.

### 3. Score, risk and status
- Implemented exactly as `docs/SCORING.md`, with the tests in that document passing.
- The overview shows the score ring with change since baseline, the four component bars, the risk panel and the status with its reason.
- Cardiovascular risk shows "Not calculated" with an explanation.

### 4. Plates
- The patient or nutritionist uploads a photo per meal with date and time. Photos are resized on the device before upload.
- The nutritionist tags food groups (vegetables, protein and pulses, grains and millets, fruit, dairy) and flags (too much oil, sweet drink or dessert, ultra-processed).
- The plate graphic fills in as tags are chosen.
- A suggested score appears from the tags. The nutritionist sets the final score from 0 to 10 and can add a comment.
- A day view shows that day's plates.

### 5. Weekly audit
- For each programme week: daily average plate scores, days logged, flag counts, the nutritionist's review and goals, and whether the check-in was attended.

### 6. Reports
- The report shows baseline against the latest visit for each measure with change, the score and risk change, adherence, the latest review, red flags and the next step.
- Only a doctor can choose the next step and approve the report. Approval records the doctor, date and time, and locks the report version.
- The report can be downloaded as a PDF.
- The patient sees a short plain-language summary, not the doctor report.

### 7. Cohort view
- Programme lead and doctors see aggregates only: enrolled, active, completed, average score change, average days logged.

## Non-goals
- No diagnosis, no medication advice, no automated treatment decisions.
- No autonomous AI scoring of plates. Suggested tags, if added later, are always reviewed by a nutritionist.
- No cardiovascular risk until a validated chart is chosen.
- No payments in the first release.

## Pilot success measures
- At least 70% of enrolled patients log plates on 15 or more of 21 days. (Target, to confirm.)
- Every week 3 report approved by a doctor within 3 working days.
- No safety incident from a missed red flag.
