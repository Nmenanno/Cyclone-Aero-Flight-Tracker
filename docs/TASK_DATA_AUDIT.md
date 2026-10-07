# Task data audit

Source: updated 15-page Ordered Task Plan. 62 numbered rows. Only PM-001 and PM-002 have checked completion boxes; dates, owners and completion timestamps are not invented.

## Interpretation

Primary ownership follows the first team printed in the source, not the task prefix. Raw team labels are retained. Program Tech and PMT display in Program; Propulsion displays in Electrical; Autopilot in Programming. Secondary labels remain intact. Confirm these display mappings.

Flight-critical flags use the PDF light-red row shading. Asterisks are retained separately as priority markings; they are not treated as a calculated critical path. Review requirements are a conservative initial application policy, not a source approval.

The PDF skips phase 6. Phase 5 includes FT-001 and FT-002. Original numbering is retained. No separate descriptions are supplied. No task durations are supplied. No calculated critical path is claimed.

Sep 25, Sep 29 and Oct 6 gates say DONE, while PM-003/004/005, AERO-001, STR-001, PM-006/007 and related tasks remain unchecked. Gate labels are stored as source observations, not automatic task completion or readiness approval.

Milestone task associations are proposed mappings from gate descriptions; administrators must confirm them. Nov?? ground-test gate remains uncertain; Nov 18–20 planning range comes from the user request. FT-010 fallback Dec 4 is after the first-flight fallback Dec 3; preserved.

EXT is described in the legend but no explicit EXT task markers appear in extracted rows. External-work titles are preserved; no new source tag is inferred.

## Required confirmations

- **PM-003**, page 3: Target is after recovery; retained as printed pending confirmation.

- **PM-006**, page 5: Historical TODAY annotation removed from displayed definition.

- **ELEC-003**, page 5: Sep 4 target precedes its predecessor and plan start; retained pending confirmation.

- **ELEC-008**, page 8: target deadline missing/invalid: Oct XX.

- **ELEC-009**, page 8: target deadline missing/invalid: Oct XX.

- **PRG-005**, page 10: absolute deadline missing/invalid: Oct 34.

- **MFG-010**, page 10: Definition of Done is incomplete; administrator confirmation required.

- **ELEC-011**, page 11: target deadline missing/invalid: Nov XX.

- **PRG-007**, page 11: Definition of Done is incomplete; administrator confirmation required.

- **FT-001**, page 12: target deadline missing/invalid: not provided.

- **FT-001**, page 12: recovery deadline missing/invalid: not provided.

- **FT-001**, page 12: absolute deadline missing/invalid: not provided.

- **FT-001**, page 12: Definition of Done not provided.

- **FT-002**, page 12: target deadline missing/invalid: not provided.

- **FT-002**, page 12: recovery deadline missing/invalid: not provided.

- **FT-002**, page 12: absolute deadline missing/invalid: not provided.

- **FT-002**, page 12: Definition of Done not provided.

## Completion provenance

Imported checked tasks have unknown completion dates and actors. Application-completed tasks will record both. Unchecked means Not Started as an initial workflow value, not a claim that no work has occurred.

## Validation

Run `pnpm validate` to verify count, IDs, dependencies, cycles, dates and source statuses. Seed imports are insert-only; rerunning does not overwrite live task progress.

## Predecessor target-date contradictions

- PM-006: Target 2026-09-29 precedes predecessor PM-004 target 2026-10-04; confirm schedule.
- ELEC-003: Target 2026-09-04 precedes predecessor ELEC-002 target 2026-10-06; confirm schedule.
- PM-007: Target 2026-10-06 precedes predecessor PM-003 target 2026-10-29; confirm schedule.

## Source fingerprint

SHA-256: `c400de6e0df65757777442bffa7b962f39f24d54889a42c256100f6982070df5`
