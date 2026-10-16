# Annam (അന്നം)

Nutrition follow-up for clinics and labs. One patient profile holds the measures, the patient's answers, every
plate, the weekly reviews, a health score, a risk profile and a doctor-approved report.

## Run it locally
```bash
pnpm install
pnpm dev            # http://localhost:3000, embedded database in .data/, six sample patients
```
Development logins (development only; production refuses them):

| Username | Password | Who |
| --- | --- | --- |
| `rmclinic` | `annam-clinic-dev` | RM Clinic staff: register, consent, measures, plates, doctor's decisions |
| `nutritionist` | `annam-nutritionist-dev` | Good Food Guru: plate reviews, weekly reviews |
| `admin` | `annam-admin-dev` | Cohort totals and audit log (no TOTP needed until `ANNAM_ADMIN_TOTP_SECRET` is set) |

Each sign-in also asks for your own name; it goes on everything you record.

## Checks
```bash
pnpm lint && pnpm typecheck && pnpm test   # unit and database tests
pnpm build && pnpm e2e                      # browser tests: all roles, the full workflow, axe, 390 px phone
```

## Deploy (Vercel + Supabase, Mumbai)
1. Create a Supabase project in **Mumbai (ap-south-1)**. Copy the pooled connection string (port 6543).
2. Run `pnpm credentials`. It prints three passwords, an admin authenticator secret, and the environment values.
3. Import the repo into Vercel. Set `DATABASE_URL`, the three `ANNAM_*_PASSWORD_HASH` values,
   `ANNAM_ADMIN_TOTP_SECRET` and `CRON_SECRET`. Functions run in `bom1` (see `vercel.json`).
4. Deploy. Tables are created on first start. Production starts empty (no samples).
5. Work through `docs/PILOT_CHECKLIST.md` before the first real patient.

For a demo with sample patients only, also set `ANNAM_SEED_SAMPLES=true`, and never enter real data there.

## Docs
`CLAUDE.md` (rules), `docs/SCORING.md` (the score, built on Life's Essential 8 with WHO Asian BMI cut-offs),
`docs/DATA_MODEL.md`, `docs/WORKFLOW.md`, `docs/DESIGN.md`, `docs/COMPLIANCE.md`, `docs/SAFETY_REVIEW.md`,
`docs/PILOT_CHECKLIST.md`, `docs/PRD.md`.
