# Database and backups

Migrations create teams, profiles, memberships, tasks, dependency edges, history, deliverables, extension requests, milestones, meetings, agenda selections, notes, readiness conditions/reviews, project settings, notifications, command receipts and task counters.

The project is a dedicated single-program database. Team memberships are scoped by primary team. User-created profiles default to no permissions. Only a trusted SQL bootstrap can create the first Director. Client-supplied metadata cannot grant roles.

Anonymous reads are limited to non-sensitive task fields, team names, dependencies, milestones, checklist states, project settings and a meeting-schedule RPC. Private evidence, extension records and histories use task-level access. Leadership meeting notes/snapshots require membership. Auth email addresses remain in Supabase Auth, outside public application tables.

Application mutations use `command(action, payload, request UUID)`. Status updates require an expected version. Completion checks all predecessors and Definition of Done. Evidence-required tasks first enter submitted; Director evidence approval and task approval are separate. Baselines cannot be changed through the command whitelist. Critical relationship/date changes require Director authority. Cycles are rejected under the project transaction lock.

`pnpm seed` regenerates SQL from the validated source dataset. Run the SQL through an authenticated administrator's SQL Editor. It is insert-only, with a source-import marker preventing restoration of old dependencies over live changes. Migrations are applied once, in order.

## Back up and recover

Use the Administration export for a portable record snapshot. It includes structured task/history/meeting data and evidence references. It is not a full disaster-recovery backup.

For full recovery, use Supabase database backups or a PostgreSQL dump through an authorized connection, plus a separate backup of objects in the private `deliverables` Storage bucket. Database backups do not substitute for file-object backups. Store connection strings and dumps outside this public repository. Restore into a separate test project first, check row counts and storage references, then switch the app's public project URL/key only after verification.

Do not import arbitrary JSON by direct browser upsert. It could bypass version, history and graph validation. Initial source import is supplied; bulk recovery is an administrative database operation.
