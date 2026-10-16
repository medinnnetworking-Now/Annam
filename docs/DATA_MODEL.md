# Annam: data model

Postgres (Supabase, Mumbai) in production; embedded PGlite in development and tests. Schema:
`src/lib/db/migrations.ts`, applied at start-up and recorded in `schema_migrations`.

## Tables
| Table | Purpose |
| --- | --- |
| `accounts` | The three fixed staff logins: `nutritionist`, `rmclinic`, `admin`. Password hashes (scrypt) come from environment variables. Failed attempts and lockout. |
| `sessions` | One row per sign-in: SHA-256 of the cookie token, the account, the **person's name** typed at sign-in, expiry, revocation. |
| `patients` | `code` (AN-0001), name, **date of birth** (age is calculated, never stale), sex, referrer, start date, family history, triage flags, enrolment `state`, who cleared them, `is_sample`. |
| `consents` | Consent text version, who recorded it, when; withdrawal time and who. |
| `visits` | Label, date, 17 measures, the lifestyle answers (activity minutes, sleep, tobacco, second-hand smoke, IDRS activity), medicine yes/no (BP, cholesterol), diagnosed diabetes, confirmed warnings, entered by. |
| `plates` | Meal, date, time, photo (JPEG ≤400 KB, metadata stripped, stored privately in the database), tags, flags, score, comment, uploaded by, reviewed by. |
| `weekly_reviews` | Per programme week: review, goals, check-in attended, author. |
| `score_snapshots` | One per visit: score version, score, category, components, IDRS, FIB-4, eGFR, WHtR, metabolic syndrome, status, reasons, comparable changes. |
| `alerts` | Red flags per visit; acknowledged by whom, and which doctor was told. |
| `reports` | Versioned. Content frozen as JSON, next step, approving doctor, recorded by, approval time, `locked`. |
| `audit_events` | Account, person, action, table, row id, patient id, and only column names or non-clinical details. |

## Guards in the database (not only in the app)
- Every write to a clinical table needs a named actor (`annam.account`, `annam.staff`), or it fails.
- A trigger writes an audit row for every insert, update and delete on clinical tables. Updates record **which columns**
  changed, never values.
- No visit, plate or weekly review can be inserted without current consent.
- Approved (locked) reports can't be updated or deleted, except by the retention job.
- The audit log is append-only.

## Access (enforced on the server for every page, action and route)
| Account | Patients | Visits | Plates | Weekly reviews | Reports | Cohort | Audit log |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RM Clinic (`rmclinic`) | Add, consent, state, withdraw, export | Record | Upload; delete unreviewed | Read | Draft; record the doctor's approval | Totals | No |
| Nutritionist | Read | Record | Upload, review, delete | Write | Draft, read | No | No |
| Admin | No | No | No | No | No | Totals | Read, export |

Doctors don't have logins (as decided): clinic staff record the doctor's clearance, red-flag acknowledgement,
next step and approval, always with the doctor's name. The patient has no login either: staff ask the questions and
enter the answers; the patient gets a printed summary after approval.

## Retention
`ANNAM_RETENTION_DAYS` (unset = the job does nothing). When set, the daily job deletes patients whose consent was
withdrawn, or whose last report was approved, more than that many days ago. The audit log keeps ids only.
