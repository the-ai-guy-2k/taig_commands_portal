# ACI-TAIG-COMMAND-PORTAL-008 execution report

Capability: Dynamic Task Form + Procedure View
Status: PASS, pending XNQEN acceptance of this evidence
Branch: `feature/aci-008-task-form-procedure-view`
Base: `a17ffd5dd6d26ac07081fb6c9be9f3cd8116fe56` (`feature/aci-007-engineer-ui-shell`)
Commit: the commit that contains this report. The SHA is returned with the ACI execution record.

The ACI-001 loader, ACI-002 catalog, ACI-003 input contract, ACI-004 workflow resolver, ACI-005 renderer, ACI-006 procedure generator, and ACI-007 discovery shell were not replaced. The form is a projection of `discoverTaskInputContract`. Generation calls those services and stops before workflow resolution unless validation state is `READY`.

## Files created

- `lib/portal/types.ts`
- `lib/portal/forms.ts`
- `lib/portal/messages.ts`
- `lib/portal/session.ts`
- `lib/portal/view.ts`
- `lib/portal/run.ts`
- `lib/portal/load.ts`
- `lib/portal/actions.ts`
- `components/task-form.tsx`
- `components/procedure-view.tsx`
- `tests/task-procedure-ui.test.ts`
- `docs/task-form-procedure-view.md`
- `docs/aci-008-execution-report.md`

## Files modified

- `lib/rendering/render.ts`
- `lib/rendering/index.ts`
- `lib/discovery/support.ts`
- `components/task-discovery.tsx`
- `app/page.tsx`
- `app/globals.css`
- `docs/engineer-ui-shell.md`
- `README.md`

`isCredentialName` is now exported from the renderer so the form can refuse a credential-named contract field without copying that name list. Renderer behavior is unchanged.

## Dynamic form

Workflow-backed tasks receive fields from the input contract: description, input key, required state, and the research example as help text. Examples are not the input values. Proof contracts that emerged from the catalog:

- `task-locate-mac`: `mac`, `interface`, `vlan_id`
- `task-interface-drops`: `interface`
- `task-lacp-check`: `group`
- `task-add-trunk-vlan`: `interface`, `vlan_list`, `vlan_id`

`task-command-reload` has no form entry.

## Procedure view

Generated procedures show the task summary, accepted engineer inputs, environment and support, then phases in order: pre-check, configuration, verification, troubleshooting. Rollback is strategy plus instruction text. Warnings, sources, and known gaps follow. Coverage stays `seed_partial`, completeness claim false, lab validation false, and `documentation_reviewed_not_device_tested`. `deviceExecutionAuthorized` stays false.

## Proof tasks

### task-locate-mac

Inputs `aabb.ccdd.eeff`, `Gi1/0/24`, and `30`. Empty Generate first returned `NEEDS_INPUT` for `mac`, `interface`, and `vlan_id`. The completed form returned `READY` and `GENERATED`. Commands included `show mac address-table address aabb.ccdd.eeff`, `show mac address-table interface Gi1/0/24`, and `show mac address-table vlan 30`. The research example `GigabitEthernet1/0/10` was help text and was not a rendered value. Configuration said configuration is not required. Activity `read_only`. Troubleshooting was marked not the normal path.

### task-interface-drops

Selecting it cleared the locate-mac values. One empty `interface` field. Input `Gi1/0/24` generated commands that reuse that value, including `show interfaces Gi1/0/24` and `show interfaces Gi1/0/24 counters errors`. Configuration was not required.

### task-lacp-check

One `group` field. The research example `1` was not the input. Input `5` generated a procedure containing `show etherchannel 5 detail`. Configuration was not required.

### task-add-trunk-vlan

Fields reset from the previous task. Inputs `Gi1/0/48`, `30,40`, and `30`. Generate was activated with Enter on the focused Generate control. Activity `configuration_changing`. Configuration commands included:

- `configure terminal`
- `interface Gi1/0/48`
- `switchport trunk allowed vlan add 30,40`
- `end`

Rollback strategy `remove_only_new_addition` was visible. The rollback text did not contain `no switchport`. Device execution was not authorized.

## Command-only proof

`task-command-reload`, title "Restart the device". Panel text: "Command guidance only. Workflow not established. Procedure not available." No inputs and no Generate control. The previously generated trunk procedure was cleared.

## Stale-result control

After the locate-mac procedure was generated, changing `vlan_id` from `30` to `31` removed the procedure. Changing the selected task cleared both the values and the procedure. A late generation response is ignored when the generation id no longer matches.

## Other browser checks

- `locate mac` showed 0 of 48 and the status "No catalog tasks match this filter. No task identity was created from the search text."
- The narrow layout kept the form labels, inputs, and command-only panel readable.
- At 1280px the workspace was a two-column grid, 776px and 448px.
- Copy controls were present on rendered commands. They copy text only.

## Tests

Command: `npm test`
Result: 83 passed, 0 failed.

- `tests/knowledge-loader.test.ts`: 19 passed
- `tests/task-resolution.test.ts`: 14 passed
- `tests/input-validation.test.ts`: 11 passed
- `tests/workflow-resolution.test.ts`: 11 passed
- `tests/command-rendering.test.ts`: 9 passed
- `tests/procedure-generation.test.ts`: 6 passed
- `tests/task-discovery.test.ts`: 7 passed
- `tests/task-procedure-ui.test.ts`: 6 passed

`npx tsc --noEmit` completed with exit code 0.
`npm run build` completed with exit code 0.

## Scope confirmation

No device credentials. No live device behavior. No AI dependency. No hard-coded proof-task field sets. The UI does not parse Cisco research files.

## Unresolved gaps

None material. Categories with zero tasks remain omitted from the category filter, which is the ACI-007 catalog decision. The Next.js development overlay showed a badge; its readable text was stylesheet content, not an application error. The production build completed.

## Minority Report

NONE
