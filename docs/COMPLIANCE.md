# Annam: compliance, safety and security

This is a checklist for the team and for Claude Code. It is not legal advice. A lawyer must review it before real patients are enrolled.

## Privacy: Digital Personal Data Protection Act, 2023
- Record consent before any data is entered, with the consent text version.
- Collect only what the programme needs. No Aadhaar numbers, no photos of faces.
- State the purpose in the consent text: care, follow-up and reports for the referring doctor.
- Retention and deletion rules in one config value, enforced by a scheduled job.
- A breach response plan, with who is told and when.
- Written agreements with every processor: hosting, storage, email or messaging, PDF services.
- Let a patient see and export their own data, and withdraw consent.

## Medical software
A tool that calculates risk to support diagnosis or treatment may be regulated as medical device software under India's Medical Devices Rules, 2017. Take regulatory advice before launch. Until then, position Annam as clinician-reviewed decision support: it calculates and displays, and clinicians decide.

## Clinical safety
- The clinical lead signs off the score weights, risk tools, red flags and the plate audit rubric.
- Red flags alert the doctor the same day and are shown on the overview and report.
- No medication advice anywhere. Nutritionists never change doses.
- Doctors approve every report before it is shared with the patient.

## Claims
Patient-facing copy never uses "reverse", "cure", "longevity", "biological age" or "remission". Use "supports" and "helps manage". Marketing copy follows the same rule.

## Commercial safeguards
Nobody is paid per patient referred. Patients may use any lab; RM Labs is an option. Interests are disclosed to patients.

## Security controls
- Access checked on the server for every read and write, tested for each account; the database itself refuses writes without a named actor or current consent.
- Three fixed staff logins with strong passwords set by the admin (`pnpm credentials`); each sign-in records the person's name. Five failed attempts lock the account for 15 minutes. Sessions expire (10 hours; admin 2 hours). The admin uses two-factor authentication.
- Photos stored privately in the database, served only to signed-in staff with `no-store` caching; metadata stripped.
- Encryption in transit and at rest. Daily backups, and a tested restore.
- Audit log of every create, update, delete, export and approval.
- No personal data in logs, analytics, error reports or screenshots.
- Host in an India region where available, and record where each processor stores data.
- Dependency updates and secret scanning in CI.

## Development rules
- Synthetic data only, labelled "Sample", in development, tests and previews.
- Never paste real patient data into Claude Code or any AI tool.
