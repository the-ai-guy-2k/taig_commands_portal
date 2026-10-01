# ACI-TAIG-COMMAND-PORTAL-009 execution report

Capability: Failure / Coverage UX
Status: PASS, pending XNQEN acceptance of this evidence
Branch: `feature/aci-009-failure-coverage-ux`
Base: `4e2e316ea2b85cb9c77794d791e8dd97166fb4e5` (`feature/aci-008-task-form-procedure-view`)
Commit: the commit that contains this report. The SHA is returned with the ACI execution record.

Accepted loader, catalog, validation, workflow, rendering, procedure, discovery, and form behavior were not replaced. `lib/coverage/present.ts` maps those existing states to engineer language. React components render that mapping.

## Files created

- `lib/coverage/types.ts`
- `lib/coverage/present.ts`
- `components/coverage-presentation.tsx`
- `tests/failure-coverage.test.ts`
- `docs/failure-coverage-ux.md`
- `docs/aci-009-execution-report.md`

## Files modified

- `lib/portal/types.ts`
- `lib/portal/run.ts`
- `lib/portal/messages.ts`
- `lib/discovery/support.ts`
- `components/task-discovery.tsx`
- `components/task-form.tsx`
- `components/procedure-view.tsx`
- `components/data-error.tsx`
- `app/globals.css`
- `docs/task-form-procedure-view.md`
- `README.md`
- `tests/task-discovery.test.ts`
- `tests/task-procedure-ui.test.ts`

`run.ts` now copies candidates, exclusion, and data errors that the resolver already returned. It does not add a resolution rule.

## Coverage UX

The package panel states `PARTIAL`, completeness claim `false`, lab validation `false`, and `documentation_reviewed_not_device_tested`, and explains that the false values are coverage limits rather than a failed load. The primary boundary and excluded software remain visible.

Workflow-backed tasks are labeled `Partial seed (seed_partial)` and `Not device tested`. Command-only tasks are labeled `Command-only (command_only)`. A generated procedure has a coverage summary: task coverage, package status, validation status, completeness claim, lab validation, platform boundary, known-gap count, and device execution authorization.

## Failure UX

- `NEEDS_INPUT` names the task and the missing keys, attaches the same fact to each empty field, and does not show a procedure.
- `INVALID_INPUT` repeats the backend reason and does not add a VLAN range or other Cisco rule.
- `UNSUPPORTED_VALIDATION` says validation is not established and does not mark the value invalid. A fixture with `declared_unevaluable` range proves that path.
- `AMBIGUOUS` lists candidates and does not choose one. Catalog search still does not call task resolution.
- `UNSUPPORTED` uses different headlines for no match and excluded software.
- `DATA_ERROR` is a hard stop with the diagnostic code. A loader failure says it is not an empty search.
- `INCOMPLETE_PROCEDURE` is not presented as a generated procedure.

## Command-only proof

`task-command-reload` shows: the task is known, workflow is not established, procedure is not available, coverage `command_only`, activity `not_established`. No form and no Generate control. The previous procedure was cleared.

## Procedure proof

`task-locate-mac` is `read_only`, says configuration is not required, keeps `seed_partial`, and does not claim device validation.

`task-add-trunk-vlan` is `configuration_changing`, shows `remove_only_new_addition`, a source-backed caution, and device execution authorized `false`.

## Known gaps

Known gaps are a disclosure under the procedure. The summary gives the count and says they are limitations, not extra warnings.

## Tests

Command: `npm test`
Result: 93 passed, 0 failed.

- `tests/knowledge-loader.test.ts`: 19 passed
- `tests/task-resolution.test.ts`: 14 passed
- `tests/input-validation.test.ts`: 11 passed
- `tests/workflow-resolution.test.ts`: 11 passed
- `tests/command-rendering.test.ts`: 9 passed
- `tests/procedure-generation.test.ts`: 6 passed
- `tests/task-discovery.test.ts`: 7 passed
- `tests/task-procedure-ui.test.ts`: 6 passed
- `tests/failure-coverage.test.ts`: 10 passed

`npx tsc --noEmit` completed with exit code 0.
`npm run build` completed with exit code 0.

## Browser validation

Package coverage, empty `task-locate-mac` submit, generated read-only procedure, generated configuration-changing procedure, command-only selection, and `locate mac` showing 0 of 48 were exercised. At 1280px the workspace remained two columns. The narrow layout kept the package panel readable.

## Scope confirmation

No new Cisco validation rule. No new workflow or command. No fuzzy match. No device credentials. No live device behavior. `deviceExecutionAuthorized` remains false.

## Unresolved gaps

None material. The Next.js development overlay badge was present. Its readable content in prior runs was stylesheet text, and the production build completed.

## Minority Report

NONE
