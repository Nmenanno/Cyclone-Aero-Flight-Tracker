# Verification record

Local checks execute the production SQL in PGlite (real PostgreSQL compiled to WASM), with Supabase Auth/Storage table/function stubs. This verifies PostgreSQL policies and transactions; it does not prove the hosted Auth email or Storage HTTP service works.

Covered: 62 tasks and exact checked statuses; unique IDs; valid normalized dates; resolved acyclic graph; two-predecessor blocking; transitive impact; agenda updates; DST-safe dates; anonymous/unauthorized/cross-team denial; assigned sublead restrictions; safe generated IDs; completion timestamps/actors; evidence-review lifecycle; immutable baselines; Director-only extensions; version conflicts; duplicate request keys; private evidence and bucket policies; frozen snapshots; readiness gates; insert-only seed replay.

Build uses strict TypeScript and Vite. Browser review covers dashboard, direct team/task routes, meeting agenda, source uncertainty display, readiness state and responsive phone layout. The local preview is read-only because no Supabase project credentials have been provided.

Hosted checks remain pending: deployed magic-link delivery/return, independent browser sessions observing shared changes, actual private file upload/download and signed-link expiry, Supabase-hosted RLS behavior, Pages deployment and live URL refresh. Production must not be declared ready until those checks pass.

The initial GitHub run passed installation, source validation and database tests, then stopped at missing backend configuration. The workflow now separates that setup condition from code failures: CI can pass while deployment remains skipped. GitHub Pages is configured for Actions. The intended live URL returned HTTP 404 before backend setup.

Latest local result: 27 automated checks passed, including explicit approval followed by readiness invalidation, assigned-sublead authorization, milestone conflict checks, countdown synchronization, and rejection of privileged frontend keys.

Hosted setup: applied both schema/storage migrations and seed to the dedicated Supabase project. The public Data API returns 62 tasks with exactly two recorded completions. Production and local authentication redirects and both public GitHub repository variables are saved. Email delivery, first Director setup and authenticated multi-user acceptance remain pending.

First connected deployment succeeded: https://github.com/Nmenanno/Cyclone-Aero-Flight-Tracker/actions/runs/37717801466 . Live URL returned HTTP 200. Browser checks confirmed database-backed dashboard data and successful direct Structures/task route refresh. All six public tables returned HTTP 200; anonymous profiles, deliverables, extension requests and task history returned HTTP 401. An anonymous call to the actual command signature returned PostgreSQL 42501 (permission denied). Email authentication is enabled with confirmation required; no custom SMTP is configured. No source task was modified during hosted checks.

Shared-code release: 28 checks pass, including missing/incorrect codes, every-write verification, code rotation, private-table denial, conflicts, idempotency and dependencies. Hosted verification accepts the chosen code and rejects a wrong code. A no-change completion request preserved the existing task version. Private verifier/profile/evidence/receipt tables reject anonymous reads. No engineering progress was changed. Browser control timed out at publication; final live UI interactions remain unverified.
