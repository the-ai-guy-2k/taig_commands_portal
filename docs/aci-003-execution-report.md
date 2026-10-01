# ACI-TAIG-COMMAND-PORTAL-003 execution report

Capability: Required Input & Parameter Validation
Status: PASS, pending XNQEN acceptance of this evidence
Branch: `feature/aci-003-input-validation`
Base: `7f0da9acd699077dd21710b1d7a3f6a7fe854a63` (`feature/aci-002-task-resolution`)
Commit: the commit that contains this report. The SHA is returned with the ACI execution record.

The ACI-001 loader and ACI-002 task resolver were not replaced. `lib/knowledge` and `lib/tasks` are unchanged.

## Files created

- `lib/inputs/types.ts`
- `lib/inputs/contract.ts`
- `lib/inputs/validate.ts`
- `lib/inputs/index.ts`
- `tests/input-validation.test.ts`
- `docs/input-validation.md`
- `docs/aci-003-execution-report.md`

## Files modified

- `app/page.tsx`
- `README.md`

## Discovered proof-task contracts

| Task | Required inputs | Binding evidence | Empty result | Complete result |
| --- | --- | --- | --- | --- |
| `task-locate-mac` | `mac`, `interface`, `vlan_id` | `mac-address` verification, `mac-interface` verification, `mac-vlan` troubleshooting | `NEEDS_INPUT` | `READY` |
| `task-interface-drops` | `interface` | one input across `show-if`, `show-errors`, `show-ip-if`, `show-switchport` | `NEEDS_INPUT` | `READY` |
| `task-lacp-check` | `group` | `ether-detail` verification | `NEEDS_INPUT` | `READY` |
| `task-add-trunk-vlan` | `interface`, `vlan_list`, `vlan_id` | `interface` and `show-switchport` share `interface`; `trunk-add` supplies `vlan_list`; `mac-vlan` supplies `vlan_id` | `NEEDS_INPUT` | `READY` |

Examples stay examples. `mac` value `not-a-mac` and `vlan_id` value `99999` are `READY` because the package does not establish a format or range rule. `vlan_list` `"20"` and `vlan_id` `99` do not produce `CONFLICT`.

## Validation rules not established

- `syntax_elements.range` is null, so range checks are `not_established`
- format, enumeration, and cross-field checks are `not_established`
- a non-null range string is `declared_unevaluable` and returns `UNSUPPORTED_VALIDATION`
- command-only tasks have no task-level input contract

## Tests

Command: `npm test`
Result: 44 passed, 0 failed.

- `tests/knowledge-loader.test.ts`: 19 passed
- `tests/task-resolution.test.ts`: 14 passed
- `tests/input-validation.test.ts`: 11 passed

`npx tsc --noEmit` completed with exit code 0.

Negative fixtures, using in-memory copies of loaded knowledge rather than edits to the Cisco package, cover a non-scalar value, an unknown key, a command-only task, a broken binding, a missing command, conflicting range metadata, a declared unevaluable range, and excluded software `nx-os`.

## Unresolved material gaps

- No source-backed cross-field conflict rule exists, so `CONFLICT` is not produced for the proof tasks.
- Range, format, and enumeration truth remain absent. `READY` does not certify a Cisco-valid VLAN, MAC, or interface.
- Command-only tasks still have no workflow-derived input contract.
- Workflow-backed tasks remain `seed_partial`. A complete input set is not a procedure and is not device authorization.

## Minority Report

NONE.

## Recommended next gate

ACI-TAIG-COMMAND-PORTAL-004 — Workflow & Command Resolution
