# ACI-TAIG-COMMAND-PORTAL-002 execution report

Capability: Task Catalog / Task Resolution
Status: PASS, pending XNQEN acceptance of this evidence
Branch: `feature/aci-002-task-resolution`
Base: `6a33acbff66043e03a65a1d9fba52fa5cd2821bd` (`feature/aci-001-knowledge-loader`)
Commit: the commit that contains this report. The SHA is returned with the ACI execution record.

The ACI-001 loader was not replaced. `lib/knowledge` is unchanged.

## Files created

- `lib/tasks/constants.ts`
- `lib/tasks/normalize.ts`
- `lib/tasks/types.ts`
- `lib/tasks/catalog.ts`
- `lib/tasks/resolve.ts`
- `lib/tasks/load-catalog.ts`
- `lib/tasks/index.ts`
- `tests/task-resolution.test.ts`
- `docs/task-resolution.md`
- `docs/aci-002-execution-report.md`

## Files modified

- `app/page.tsx`
- `app/globals.css`
- `README.md`

## Task counts

From dataset 0.1.0:

| Count | Value |
| --- | ---: |
| Cataloged tasks | 48 |
| Workflow-backed | 12 |
| Command-only | 36 |
| Alias strings | 56 |
| Normalized alias keys | 56 |
| Cross-task duplicate aliases | 0 |
| Cross-task duplicate titles | 0 |

Workflow `intent_aliases` match `tasks[].aliases` on all 12 workflows. Command aliases were not used for task resolution.

## Alias resolution verified

- Exact task ids resolve, including case and surrounding whitespace.
- Exact titles resolve, including case and repeated internal whitespace.
- Real aliases on the four proof tasks resolve to those tasks.
- `Restart the device` resolves to command-only `task-command-reload` and stays workflow-absent.
- `locate mac` stays `UNSUPPORTED`.
- A shared alias on two fixture tasks returns `AMBIGUOUS` with both ids and no selection.
- A task id wins when another task uses that same text as an alias.
- Blank input is `INVALID_INPUT`.
- Caller software `nx-os` is `UNSUPPORTED` because it matches excluded software `NX-OS`.

## Initial candidates

| Task | Resolution | Workflow | Coverage | Activity |
| --- | --- | --- | --- | --- |
| `task-locate-mac` | Resolved | `locate-mac` present | `seed_partial` | `read_only` |
| `task-interface-drops` | Resolved | `interface-drops` present | `seed_partial` | `read_only` |
| `task-lacp-check` | Resolved | `lacp-check` present | `seed_partial` | `read_only` |
| `task-add-trunk-vlan` | Resolved | `add-trunk-vlan` present | `seed_partial` | `configuration_changing` |

No command syntax or procedure steps are included in those results. `task-dhcp-server` still carries its legacy IOS 12.4 workflow boundary.

## Tests

Command: `npm test`
Result: 33 passed, 0 failed.

- `tests/knowledge-loader.test.ts`: 19 passed
- `tests/task-resolution.test.ts`: 14 passed

`npx tsc --noEmit` completed with exit code 0.

The home page at `http://localhost:3000` rendered load status Passed, 48 cataloged tasks, 12 workflow-backed, 36 command-only, primary boundary Catalyst 9300 / IOS XE 17.15.x, and the four proof tasks with the activity values above.

## Unresolved material gaps

- Workflow-backed tasks remain `seed_partial`. Resolving one does not mean a complete procedure exists.
- Command-only tasks have no workflow, so activity evidence stays `not_established`.
- The real package has no ambiguous alias. Ambiguous behavior is proven with fixtures.
- Required-input checking and parameter validation are not part of this capability.

## Architecture observations

Catalog and resolution sit on `LoadedKnowledge` from ACI-001. Broken category or workflow references fail as `DATA_ERROR` instead of being reclassified as command-only. Read-only versus configuration-changing is derived only when every linked workflow agrees: empty configuration plus rollback `none_read_only`, or a non-empty configuration phase.

## Minority Report

NONE.

## Recommended input to ACI-003

Required-input validation should use `syntax_elements` on the commands a later capability selects. This resolver does not select commands. Keep `seed_partial`, workflow platform boundaries, and command-only status visible when a resolved task asks for inputs.
