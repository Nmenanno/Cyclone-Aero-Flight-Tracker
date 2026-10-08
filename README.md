# Cyclone Aero — Team Task Tracker

**Live website:** https://nmenanno.github.io/Cyclone-Aero-Flight-Tracker/

A simple shared checklist for the November 21, 2026 first-flight target. Each team sees its next available tasks, due dates and blockers. Open task details, start work, mark it done or reopen it.

Everyone can view tasks. Enter the shared team code to unlock updates. No email account or sign-in is needed. The code is checked by the database on every change and stays only in page memory; refresh or Lock updates clears it. Obtain the code from your team lead. Never add it to this repository.

All 62 original tasks, dates, dependencies and recorded statuses are preserved. A task can be marked done after its predecessors are complete. Other devices refresh within 15 seconds. Completion records task progress; it does not authorize flight or approve technical evidence.

## Run locally

Install Node 24 and pnpm 11.25.0, run `pnpm install --frozen-lockfile`, copy `.env.example` to `.env`, set the public Supabase values and run `pnpm dev`. Without these values the site is a read-only source preview.

`pnpm check` validates the source dataset, runs 28 automated checks and builds the site.

## Shared data and deployment

Supabase stores shared tasks and checks updates on the server. GitHub Actions deploys pushes to main to GitHub Pages. Hash routes support direct team and task links. The repository variables are `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; never use a service-role key.

The first two migrations establish the original protected schema. The third, `202610080001_simple_progress.sql`, adds shared-code progress updates. Existing installations apply only the new migration; do not rerun initial schema files. The code verifier is set privately in Supabase and cannot be read by public clients.

The earlier leadership interface is retained in source for reference but is not included in the active website. Private uploads, profiles and administrative records remain protected. The current interface intentionally focuses on task progress.

## Files

- `src/SimpleTracker.tsx`: active interface and public-data loading
- `src/lib/engine.mjs`: dependencies and task ordering
- `data/first_flight_tasks.json`: audited source tasks
- `supabase/migrations/`: database setup
- `tests/`: authorization and task workflow checks
- [Lead guide](docs/LEAD_GUIDE.md)
- [Source-data audit](docs/TASK_DATA_AUDIT.md)
- [Verification](docs/VERIFICATION.md)

Back up the database and private Storage files through Supabase to a restricted team location. The simple website does not expose private exports or administrative actions.
