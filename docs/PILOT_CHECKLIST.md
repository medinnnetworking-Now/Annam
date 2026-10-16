# Annam: pilot checklist

Nothing here is done until a named person signs it. No real patient is entered before every line is signed.

| Item | Owner | Signed by | Date |
| --- | --- | --- | --- |
| Lawyer reviews the consent text (`src/content/consent.ts`) and privacy notice under the DPDP Act 2023; final text replaces the placeholder and `CONSENT_VERSION` changes | | | |
| Retention period set with legal advice (`ANNAM_RETENTION_DAYS`) | | | |
| Regulatory advice on medical device software (Medical Devices Rules 2017) | | | |
| Clinical lead signs off `docs/SCORING.md`: score, BMI adaptation, risk tools, red flags, plausibility ranges, plate rubric | | | |
| Clinical lead chooses (or confirms "not yet") a cardiovascular risk chart for South Asia | | | |
| Processor agreements: Vercel, Supabase (and any email or messaging service later) | | | |
| Supabase project in Mumbai (ap-south-1) confirmed; Vercel functions in bom1 confirmed | | | |
| Daily backups on; a restore tested on staging and written down | | | |
| Passwords generated with `pnpm credentials`, given to each team in person; admin TOTP set up | | | |
| `ANNAM_SEED_SAMPLES=false` in production; production database empty | | | |
| Staff training: consent script, asking the lifestyle questions, red-flag same-day call, photos without faces | | | |
| Incident contact and breach response plan named | | | |
