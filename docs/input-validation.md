# Required input and parameter validation

ACI: ACI-TAIG-COMMAND-PORTAL-003
Depends on the accepted ACI-001 loader and ACI-002 task resolver. This capability does not render Cisco syntax, substitute parameters into command templates, or generate a procedure.

## Discovery

`discoverTaskInputContract` accepts loaded knowledge and an already resolved catalog task.

A command-only task has no workflow. Discovery returns `UNSUPPORTED_VALIDATION` with reason `input_contract_not_established`. Commands that merely cite that task are not turned into a task form.

A workflow-backed task is walked in phase order (`pre_check`, `configuration`, `verification`, `troubleshooting`) and then step order. Each step's `parameter_values` and the referenced command's `syntax_elements` are the only sources of engineer inputs.

An element becomes a task input when the workflow step binds its name. An unbound element with `required: false` is not requested. A required element that the step does not bind is a broken contract and returns `DATA_ERROR`, not an invented value.

Research `parameter_values` are example bindings. They are stored as `exampleValue`. They are not the engineer's answer and they are not an enumeration.

The contract records command id, phase, and step index as provenance. It does not copy command syntax.

## Consolidation

Two bindings are the same engineer input only when all of these match:

- parameter name
- syntax-element description
- syntax-element range
- bound example value

The task-level requirement is required if any matching occurrence has `required: true`. A required-flag difference alone does not split the input and does not fail the contract. `task-interface-drops` therefore has one required `interface` input used by `show-if`, `show-errors`, `show-ip-if`, and `show-switchport`.

Different names stay separate. `vlan_list` and `vlan_id` are not merged because both can be illustrated with 20.

The same name with a different example stays separate. `task-dhcp-server` binds `address` on `dhcp-router` to `192.0.2.1` and on `dhcp-dns` to `198.51.100.53`. Those remain `dhcp-router.address` and `dhcp-dns.address`. The command prefix is an application key so the two values are not collapsed. It is not a new Cisco parameter name. If the same unproven name were used by more than one command inside one group, discovery returns `DATA_ERROR` with `AMBIGUOUS_PARAMETER_KEY` instead of inventing a field.

The same name and description with different range metadata returns `DATA_ERROR` with `INCOMPATIBLE_PARAMETER`.

## Validation boundaries

Supported checks:

- presence of each required input
- value shape limited to a non-empty string or a finite number, because every workflow binding in this package is one of those two shapes
- surrounding whitespace trim on strings, with the original value kept
- empty string and whitespace-only string treated as missing

Not established, and therefore not enforced:

- numeric ranges
- interface-name format
- MAC-address format
- VLAN ranges or reserved VLAN rules
- subnet or address-family rules
- enumerations
- cross-field relationships

`syntax_elements.range` is null on the accepted package. That state is `not_established` and does not block `READY`. A non-null range string has no evaluation grammar in this capability, so the result is `UNSUPPORTED_VALIDATION`. The supplied value is not marked invalid because of that string.

Descriptions such as "Cisco dotted MAC address" are recorded text. They are not executable format rules.

No workflow in the accepted package states a deterministic conflict between two supplied values. `CONFLICT` is a reserved state. Differing `vlan_list` and `vlan_id` values do not produce it.

Unknown keys are listed on `unknownInputs` and omitted from `accepted`. They do not by themselves block `READY`, and they are not available for later command rendering.

Caller context that matches package `excluded_software` returns `UNSUPPORTED_VALIDATION`.

State precedence when a contract exists:

1. `UNSUPPORTED_VALIDATION` for excluded software or a declared unevaluable range
2. `INVALID_INPUT`
3. `CONFLICT`
4. `NEEDS_INPUT`
5. `READY`

Broken workflow or command bindings return `DATA_ERROR` before any of those states.

## READY

`READY` means every deterministically required input is present and no supported validation rule fails. It means the task is ready for the next governed capability. `deviceExecutionAuthorized` is always false. `READY` does not mean the values are safe to apply on a Cisco device.

Package `completeness_claim` remains false, `lab_validation` remains false, and workflow-backed tasks remain `seed_partial`.

## Command-only behavior

`task-command-reload` and the other 35 command-only tasks stay `UNSUPPORTED_VALIDATION` / `input_contract_not_established`. This capability does not infer a procedure-specific input list from command tags.
