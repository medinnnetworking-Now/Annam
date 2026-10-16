# CLAUDE.md: Annam (അന്നം)

## What Annam is
A nutrition follow-up platform for clinics and labs. RM Clinic registers a patient and records consent, measures,
labs and the patient's answers. For three weeks the patient's meal photos are uploaded and the Good Food Guru
nutritionist reviews each plate and writes weekly reviews. At week 3 measures are repeated, the score and risk are
recalculated, and a report goes to the doctor, who decides the next step and approves it. Owner: Medinn.

Read before changing anything: `docs/PRD.md`, `docs/WORKFLOW.md`, `docs/DESIGN.md`, `docs/DATA_MODEL.md`,
`docs/SCORING.md`, `docs/COMPLIANCE.md`, `docs/SAFETY_REVIEW.md`. The original prototype is `reference/prototype.html`.

## Accounts (decided by the product owner)
Three fixed logins, no sign-up: `rmclinic` (clinic staff), `nutritionist`, `admin`. Passwords are set by environment
variables (`pnpm credentials`). Each sign-in also asks for the person's own name, which goes on every record and
audit entry. Admin needs a TOTP code. Doctors and patients have no login: clinic staff record the doctor's decisions
by name, and enter the patient's answers after asking them.

## Stack
- Next.js 15 (App Router), TypeScript strict, Tailwind CSS 4 with the tokens in `docs/DESIGN.md`. pnpm.
- Postgres: Supabase Mumbai in production (`DATABASE_URL`); embedded PGlite in development and tests.
- Hosted on Vercel, functions in `bom1` (Mumbai). Daily retention cron in `vercel.json`.
- Tests: Vitest (`src/**/*.test.ts`), Playwright + axe (`tests/e2e`).

## Layout
```
src/app/              routes; server actions in src/app/actions.ts
src/components/       UI components
src/content/          consent text and patient-facing strings (one place, for Malayalam later)
src/lib/scoring/      pure score and risk functions; all numbers in config.ts
src/lib/data/         data functions: every one checks the role first
src/lib/db/           database adapter, migrations, sample seed
src/lib/auth/         passwords, TOTP, sessions, roles
tests/e2e/            end-to-end tests
```

## Commands
`pnpm dev` · `pnpm test` · `pnpm e2e` (after `pnpm build`) · `pnpm lint` · `pnpm typecheck` · `pnpm credentials`.
Lint, typecheck and tests must pass before any commit.

## Rules that never bend
1. **No real patient data** in development, tests, seeds, screenshots or logs. Samples are named "Sample" and `is_sample`.
2. **The software never decides.** It calculates and displays. Doctors decide and approve; staff record it by name.
3. **No medication advice** anywhere. Medicines are recorded only as yes/no for scoring.
4. **Claims**: never "reverse", "cure", "longevity", "biological age" or "remission" in patient-facing copy.
5. **Cardiovascular risk** stays "Not calculated" until the clinical lead chooses a South Asia chart.
6. **Score numbers** live only in `src/lib/scoring/config.ts`; bump `SCORE_VERSION` on any change; old snapshots stay.
7. **Access** is checked on the server in `src/lib/data/*` for every read and write; pages also 404 for wrong roles.
8. **Audit**: database triggers log every clinical write (column names only); sign-ins, exports, prints, approvals and audit views are logged too.
9. **Logs and analytics** never contain names, phone numbers, photos or values. Errors are logged by name only.
10. **Photos** are resized on the device, stripped of metadata on the server, stored privately, and served only to signed-in staff.

## When unsure
Stop and ask. Don't invent clinical thresholds, partner names, prices or legal positions. Mark clinical items "to confirm with the clinical lead".
