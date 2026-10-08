# Shared-code tracker — ready for activation

The user chose a shared team code on October 8, 2026. This replaces email sign-in and Director setup for the everyday tracker.

Prepared: team queues, search, details, Start / Mark done / Reopen, a shared-code unlock form, and server-side verification on every update. The code is held only in page memory and clears on refresh or Lock updates. It is not bundled in the website, committed to GitHub, or written to browser storage. Private files and profiles remain protected. Completion reports progress and never grants flight approval.

Validation: all 28 automated checks and the production build pass. Tests cover missing/wrong codes, correct-code updates, code rotation invalidating old requests, private table denial, conflict detection, idempotency and dependency blocking. Desktop layout reviewed before adding the unlock form; browser connection became unavailable during activation (three timeouts).

Not yet done: hosted migration, code activation, shared-code UI verification, and Pages deployment. Do not publish the new frontend until the database change is applied.

A private activation file exists one directory above this repository as ACTIVATE_TEAM_CODE_PRIVATE.sql. It contains the migration and salted verifier for the selected code. Keep it out of GitHub. In the dedicated Supabase project SQL Editor, paste and run that file once. Do not rerun initial migrations or the source seed. The browser credential policy requires the user to perform the credential entry/submission.

After activation: verify a wrong code is denied; verify the selected code unlocks; use a disposable fixture or a transaction rolled back in SQL to check completion without changing actual engineering progress; publish the branch and check the live website. Update README and lead guide for this simpler flow.
