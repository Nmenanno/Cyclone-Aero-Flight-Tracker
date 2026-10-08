# Cyclone Aero — First Flight

A shared project tracker for Iowa State Cyclone Aero Design's November 21, 2026 first-flight target. Find the next actionable task, review blockers, submit evidence, request extensions, and run leads/subleads meetings.

**Repository:** https://github.com/Nmenanno/Cyclone-Aero-Flight-Tracker

**Live website:** https://nmenanno.github.io/Cyclone-Aero-Flight-Tracker/

**Launch status:** Deployed and connected to Supabase with all 62 source tasks. Public pages and access restrictions are verified. First Director sign-in, team email delivery, and authenticated multi-user acceptance checks still need completion before team rollout.

## Run locally

Install Node 24 and pnpm 11.25.0. Then:

```sh
pnpm install --frozen-lockfile
cp .env.example .env
# Set the two VITE_SUPABASE_* values from your Supabase project.
pnpm dev
```

Without backend values, the app displays an explicitly marked, read-only source-plan preview. It cannot save task changes. With backend values, PostgreSQL is the sole authority; failures do not fall back to the seed. Browser storage is used only by Supabase for sign-in sessions, never as a task database.

```sh
pnpm validate
pnpm test
pnpm build
```

## Deploy

Follow [the deployment checklist](docs/DEPLOYMENT.md). Apply the two database migrations, then the seed SQL. Configure email magic links and the site redirect. Set the two public repository variables and select GitHub Actions in Settings → Pages. Every push to `main` validates data, tests PostgreSQL workflows, builds and deploys. Deployment stops if shared database configuration is missing.

## Student workflows

1. **New user:** Sign in with a magic link. This registers an unprivileged account. Give the displayed account ID to the Director.
2. **Assign a lead:** Director opens Administration → Assign team role. A person can have multiple teams. Subleads can update tasks explicitly assigned to them; leads manage primary-team tasks.
3. **Create a task:** Use Add Task. Enter title, primary team, Definition of Done, target date and predecessors. The database assigns a new ID. Only Directors change critical dependencies or committed dates.
4. **Finish work:** Open the task. Submit evidence if required, then Mark Complete. Reviewed work becomes Awaiting Review until the Director approves evidence and completion. Updates are confirmed by the server and all open clients refresh every 15 seconds and on focus.
5. **Approve an extension:** Administration shows pending requests and downstream impact. A Director records a decision and reason. Approval changes only the active target; the baseline and request history remain.
6. **Edit milestones:** Timeline → Edit milestone requirements. Confirm the proposed task mappings against team intent.
7. **Run meetings:** Meetings → choose a date. Record updates, decisions, discussed items, blockers and carried actions. Create follow-up tasks. Finalize only after the meeting: snapshots cannot be rewritten.
8. **Back up:** Administration → Export project records. This exports structured records, not uploaded file bytes. Also back up the PostgreSQL database and private Storage bucket as described in [DATABASE.md](docs/DATABASE.md).

## Repository map

| Location | Purpose |
|---|---|
| `src/App.tsx` | Dashboard, teams, task details, meetings, timeline, readiness and administration |
| `src/lib/store.tsx` | Shared Supabase reads and server-confirmed command calls |
| `src/lib/engine.mjs` | Dependency traversal, priority ranking and meeting selection |
| `src/style.css` | Cardinal/gold responsive and print styles, Tailwind integration |
| `data/` | Audited 62-task source seed and initial planning references |
| `supabase/migrations/` | Tables, permissions, transactional commands and private file policies |
| `supabase/seed/` | Insert-only initial import |
| `scripts/` | Dataset validator and seed generator |
| `tests/` | Logic and real PostgreSQL permission/workflow tests using PGlite |
| `.github/workflows/` | Automated Pages build and deployment |
| `docs/` | Setup, user guides, architecture, audit and verification |

## Source accuracy

All 62 corrected IDs and dependencies are preserved. Only PM-001 and PM-002 are explicitly checked complete. Invalid/placeholder dates become null/TBD; valid contradictory dates are retained and flagged. Owners and completion timestamps were not invented. Red-shaded critical flags and asterisk priority markings are separate. Read [TASK_DATA_AUDIT.md](docs/TASK_DATA_AUDIT.md) before resolving discrepancies.

The app does not calculate a mathematical critical path, and it does not automatically authorize flight. The readiness checklist requires evidence and explicit Director decisions.

Further reading: [Lead guide](docs/LEAD_GUIDE.md) · [Admin guide](docs/ADMIN_GUIDE.md) · [Architecture](docs/ARCHITECTURE.md) · [Database](docs/DATABASE.md) · [Verification](docs/VERIFICATION.md).


