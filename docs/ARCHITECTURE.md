# Architecture

React + TypeScript + Vite + Tailwind integration, Supabase PostgreSQL/Auth/Storage, and GitHub Actions/Pages follow the requested architecture. No replacement hosting platform or proprietary site framework is used.

`App.tsx` holds screen components and reusable cards/forms. `store.tsx` reads public project tables and role-filtered private tables, then submits commands. `engine.mjs` contains side-effect-free graph, date, ranking and agenda logic. HashRouter handles direct links without a Pages rewrite service.

PostgreSQL is authoritative. Row Level Security protects reads, direct DML privileges are revoked, and a constrained `command` RPC implements mutations with explicit authorization. Private security-definer helpers have fixed search paths and restricted execute grants. Task IDs, memberships and dependencies have relational constraints. Flexible source metadata stays in JSONB; status, identity, owners, versions and timestamps are relational.

A short transaction-scoped project lock orders graph/status/readiness mutations. Each request has an idempotency key, and edits/completion compare record versions. No optimistic success is displayed before the RPC confirms. Clients refresh on focus and every 15 seconds; this simple polling avoids requiring Supabase Realtime publication setup. Task graph availability and live agendas derive from server records.

Snapshots are server-generated JSONB containing task records, edges, notes, extensions, agenda selections, milestone references and date boundaries. They are immutable after finalization. Public users can read meeting dates/focus, but not snapshots or notes. All private files use a private bucket with task/user path checks; signed links expire in 60 seconds.

The bundled task seed is used only for initial import and an explicitly labeled local read-only review when configuration is absent. A configured database outage never switches to static data. Production CI requires backend values.

The ranking is a heuristic based on flight-critical overdue work, downstream impact, recovery/target deadlines and milestone requirements. It is not a mathematical critical path because durations and resource constraints were not supplied.
