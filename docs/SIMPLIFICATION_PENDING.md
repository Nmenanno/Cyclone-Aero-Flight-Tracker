# Shared-code tracker activation

The user selected a shared team code and completed private database activation. Hosted checks verified that the selected code is accepted and an incorrect code is rejected. A no-change request against an already-completed task succeeded without changing its version or progress. Anonymous reads of team_access, profiles, deliverables and progress_receipts are denied. All 62 source tasks remain present.

The new interface has no email login or Director setup. It displays team task queues, details, search, and Start / Mark done / Reopen. The server verifies the code on every write. It is not stored in the public source, website bundle or browser storage. Refreshing the page clears it.

28 automated checks and the production build passed. The desktop layout was reviewed before activation. Browser automation was unavailable during final publication, so a final live UI unlock/click check remains unverified. Hosted API checks and the deployment pipeline provide the recorded verification for this release.

The private activation SQL file is outside the repository and must not be committed. Do not rerun it after successful activation.
