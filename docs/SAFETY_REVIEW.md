# Annam: safety review

How each rule in `CLAUDE.md` is enforced, with the code that enforces it and the test that proves it.

| Rule | Enforcement | Tests |
| --- | --- | --- |
| 1. No real data in dev | Samples seeded only outside production (`src/lib/db/seed.ts`, `getDb`); names say "Sample"; `is_sample` shown as a chip and on reports | e2e uses synthetic names |
| 2. Software never decides | Clearance, red-flag acknowledgement, next step and approval need a doctor's name typed by staff (`src/lib/data/patients.ts`, `reports.ts`); report disclaimer | `data.test.ts` "drafts, approves and locks" |
| 3. No medication advice | Medicines are yes/no only (`src/lib/measures.ts`); summary footer says not to change medicine | e2e summary text check |
| 4. Claims | Patient strings in `src/content/summary.ts`; e2e scans the summary for banned words | `workflow.spec.ts` |
| 5. CV risk not calculated | No function exists; overview and report show "Not calculated" | `workflow.spec.ts` |
| 6. Versioned score | `src/lib/scoring/config.ts`, `SCORE_VERSION` stored per snapshot; older versions not recalculated (`refreshSnapshots`) | `index.test.ts` |
| 7. Access control | `check()` in every data function (`src/lib/data/context.ts`, `roles.ts`); `requirePermission`/404 on pages; API routes 404 without a session | `data.test.ts` roles; `auth.spec.ts` |
| 8. Audit | Triggers `annam_audit` (column names only), explicit events for sign-in, export, print, approval, state change, audit view (`migrations.ts`, `session.ts`, `admin.ts`); append-only trigger | `data.test.ts` audit tests; `workflow.spec.ts` admin check |
| 9. No PII in logs | `act()` logs only the error name (`src/lib/server.ts`); no analytics | review |
| 10. Photos | Canvas resize to 720 px, JPEG 0.7 (`PlatesClient.tsx`); server checks JPEG, strips APP1–15 and COM segments, ≤400 KB (`jpeg.ts`, `plates.ts`); served by `/api/photos/[id]` with session check and `no-store` | `data.test.ts` GPS stripped; e2e photo 404 when signed out |
| Consent | Can't create a patient without consent (zod literal true + version check); DB trigger blocks new data without current consent; withdrawal blocks immediately | `data.test.ts` |
| Sign-in | scrypt hashes from env; 5 failures lock for 15 minutes; generic error; admin TOTP required in production; session tokens hashed in DB, httpOnly, SameSite=Lax, Secure in production; 10 h (2 h admin) | `auth.spec.ts`, `data.test.ts` |
| Privacy in cohort | Totals only; groups under 5 hidden; score change hidden under 5 | `data.test.ts` |
| Retention | Config value; no-op until set; tested with a short value | `data.test.ts` |
| Accessibility | axe (WCAG 2.1 AA, serious/critical) on sign-in, list, overview, dialogs, report, summary, cohort, audit; 44 px targets; visible focus; 390 px layout with bottom-sheet dialogs | `auth.spec.ts`, `workflow.spec.ts`, `phone.spec.ts` |
