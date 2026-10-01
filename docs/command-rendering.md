# Command rendering and parameter substitution

ACI: ACI-TAIG-COMMAND-PORTAL-005
Depends on the accepted loader, task resolver, input validator, and workflow resolver. This capability renders one command template at each workflow step. It does not assemble a procedure.

## Template authority

The command string comes from `commands[].syntax` in the loaded Cisco dataset. Application code does not compose Cisco syntax. The rendered object keeps that string as `template` and stores the substituted line separately as `renderedCommand`.

Placeholders are `<name>`. An optional placeholder is `[<name>]`, and that marker agrees with `syntax_elements[].required === false`. Placeholder names must equal the syntax-element names in order. The renderer matches a placeholder to an element by that name, then to the workflow binding with the same syntax-element name, then to the Capability 3 engineer input key. It does not match by position, example value, or a similar name.

## Engineer values

Substitution uses `validation.accepted`, the values Capability 3 already accepted. The text inserted is the accepted normalized value: surrounding whitespace already removed, with no further change. Numbers are rendered with `String(value)`. A string is copied exactly, including case, punctuation, and shorthand such as `Gi1/0/24`.

Workflow `parameter_values` stay on the substitution record as `researchValue`. They are not inserted when an engineer value exists, and they are not inserted when the engineer omitted an optional value.

The same engineer input key is reused for every step that binds it. `interface` on `task-interface-drops` is one value across `show-if`, `show-errors`, `show-ip-if`, and `show-switchport`.

`dhcp-router.address` and `dhcp-dns.address` stay different keys. Both syntax elements are named `address`, and each rendered command receives only its own accepted value.

Unknown keys are not in `accepted`, so they cannot become template values.

## Static commands

A template with no placeholders renders as that template. `show version`, `show running-config`, `configure terminal`, and `end` are static because the dataset syntax has no engineer placeholder. An unbound optional placeholder is removed instead of left in the line. `ip dhcp excluded-address <low> [<high>]` renders without the bracketed high value when the engineer does not supply `high`.

## Failure

`RENDERED` means every step template resolved and every required placeholder received a validated engineer value. `deviceExecutionAuthorized` and `procedureGenerated` are false. `RENDERED` does not mean the command was lab tested or is safe to enter on a device.

The renderer returns no command list when rendering does not succeed.

| Condition | State |
| --- | --- |
| Workflow is not `RESOLVED`, or inputs are not `READY` | `UPSTREAM_NOT_READY` |
| Missing template, malformed syntax, or placeholder/element mismatch | `DATA_ERROR` |
| Binding without an engineer input key, or a binding that is not a placeholder | `BINDING_ERROR` |
| Required placeholder without an accepted value | `UNRESOLVED_PLACEHOLDER` |
| Placeholder or engineer input key is credential material | `UNSUPPORTED` |

Credential names refused exactly, after the same case-fold used for task identity, are `username`, `password`, `secret`, `community`, `token`, `credential`, `enable_secret`, and `private_key`. No accepted workflow binds those names. The dataset command `local-user` contains `username` and `secret`, and it is not a workflow step, so this capability does not collect or store that material.

A required placeholder is never left in the returned line, and it is never filled with `UNKNOWN`, a research example, or a guessed Cisco value.

## Traceability

Each rendered command keeps task id, workflow id, phase, step index, command id, template, rendered line, substitutions, CLI modes, entry context, platform family, software family, version notes, the workflow platform boundary, support and validation status, operational risk, source ids, coverage status, and the engineer input keys used. Phase membership stays `pre_check`, `configuration`, `verification`, or `troubleshooting`. Verification commands use the same substitution rules and stay in the verification phase.
