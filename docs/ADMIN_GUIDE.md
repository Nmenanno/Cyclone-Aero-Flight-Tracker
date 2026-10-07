# Director guide

Authorize registered users in Administration. Leads manage their primary teams; subleads need an explicit task owner assignment. Add multiple memberships as needed. Profiles store display names and UUIDs, not email addresses. Use the verified account ID to distinguish new users; display names can be set in Supabase.

Review the task data audit first. Timeline milestone requirements are proposed mappings and remain marked unconfirmed until edited. Gate DONE labels are observations from the PDF; individual unchecked tasks remain incomplete. Fix missing Definitions of Done before accepting completion. Use Edit Task to record confirmed dates and remove resolved audit issues.

To approve work, open the task, inspect each submission and use Review evidence. Then approve task completion separately after all acceptance criteria are satisfied. This prevents evidence approval from silently closing a task. Reopening requires a reason. Deferred tasks do not satisfy hard dependencies; an approved safe deferral must be documented as the actual completion of the applicable source task, such as PRG-007, after its Definition of Done is corrected and reviewed.

Administration lists pending extension requests and transitive impacts. Approving changes the active target only. Review affected downstream work and recovery/fallback dates separately. No dependent date moves automatically.

Meetings start October 13 and recur every 14 days. Schedule the next date, reschedule/cancel individual meetings, record discussion and carry items. Finalizing captures records on the server. Future task edits cannot modify a finalized snapshot. Notes must not contain personal contact details; public task descriptions must remain non-sensitive. Private uploads and links are available only to authorized task users.

Readiness is an explicit checklist. Each condition requires evidence and linked task completion. A separate Director decision can approve the planned test only after all conditions and FRR are approved. Reopened/changed task work invalidates authorization and related checklist reviews. Approval is not a substitute for the flight crew's on-site go/no-go decision.

Export project records from Administration regularly. Keep exports and private Storage backups in a restricted team location. Never commit them to the public source repository.
