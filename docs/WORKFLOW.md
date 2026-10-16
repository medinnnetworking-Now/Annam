# Annam: clinic workflow

## The seven steps
| Step | What happens | Who | What the system records |
| --- | --- | --- | --- |
| 1. Walk-in | Patient arrives at the clinic, gives consent, gets the balanced meal flyer | Clinic staff | Patient, consent |
| 2. Baseline | Biochemistry and anthropometry | Lab, clinic staff | Baseline visit |
| 3. Consult | Doctor sets safety limits. Nutritionist onboards: diet history, goals, calorie range | Doctor, nutritionist | Clearance, onboarding note |
| 4. Score | Baseline score and risk calculated | System | Score snapshot |
| 5. Three weeks | Daily plates, nutritionist review, weekly check-ins | Patient, nutritionist | Plates, reviews, check-ins |
| 6. Check-in visit | Repeat measures and selected labs | Clinic, lab | Week 3 visit, new score snapshot |
| 7. Report | Report to the doctor and the patient. Doctor chooses the next step | System, doctor | Report, approval, next step |

## Enrolment states
```
referred -> consented -> baseline_recorded -> cleared -> active
active -> checkin_due (day 19 onwards) -> checkin_recorded -> report_draft -> report_approved -> next_step
Exits at any point: not_suitable (triage or doctor), withdrawn (patient), paused
```
- `cleared` needs a doctor clearance. Patients flagged at triage (insulin or drugs that can cause low blood sugar, kidney disease, pregnancy, eating disorder, recent admission) stay `not_suitable` unless the doctor and clinical lead clear them.
- `next_step` is one of: 12-week programme, condition track, maintenance, back to the referring doctor.
- Every transition is written to the audit log with who, when and why.

## Daily rhythm during the three weeks
- The patient uploads each meal. A reminder goes out if no plate is logged by 21:00 (later release, with consent).
- The nutritionist reviews plates within 24 hours.
- One check-in session a week, recorded as attended or missed.
- Red flags (see `docs/SCORING.md`) alert the doctor the same day.

## Labs at week 3
Repeat what can move in three weeks: weight, waist, blood pressure, fasting and post-meal glucose, triglycerides. HbA1c is repeated at 12 weeks, not week 3.
