# Procedure generation

ACI: ACI-TAIG-COMMAND-PORTAL-006
Depends on the accepted loader, task resolver, input validator, workflow resolver, and command renderer. This capability assembles a procedure from a rendered workflow. It does not author Cisco commands.

## Ordering

`generateProcedure` requires a `RENDERED` result, a `RESOLVED` workflow, and `READY` inputs for the same task. It copies steps in workflow phase order:

1. `pre_check`
2. `configuration`
3. `verification`
4. `troubleshooting`

Step order inside a phase is the workflow step order. Commands are not sorted, merged because their text matches, or reordered from relationship edges. An empty phase stays in the procedure with no steps. `configurationRequired` is true only when the configuration section has steps.

## What is copied

Each step keeps the rendered command, the original template, command id, intent, CLI modes, operational risk, source records, and the engineer input keys used. Command `expected_output` is copied as `describedObservations` with `observationValidation` `not_established`. Workflow `expected_results` are copied as `describedResults` with the same limit. Those texts are not pass/fail rules.

Engineer inputs come from Capability 3 accepted values. Each input keeps its key, accepted value, required or optional state, and the workflow bindings. Unknown keys are not included. Research examples are not stored as the engineer value.

Rollback is the workflow strategy plus its instruction strings. Those instructions are not added as commands. No removal, save, or mode command is created unless that command is already a rendered workflow step.

Source records stay on the workflow and on each step. The procedure also keeps the package primary boundary, each workflow platform boundary, excluded software, coverage status, `completeness_claim`, `lab_validation`, workflow validation status, and the package known-gap list.

A caution string on a command stays attached to that step and is listed in `warnings`. No caution is written when the source caution is null.

Troubleshooting steps are marked `normalPath: false`. They stay in the troubleshooting section.

## Read-only and configuration-changing

`task-locate-mac`, `task-interface-drops`, and `task-lacp-check` stay `read_only` with an empty configuration section. `task-add-trunk-vlan` stays `configuration_changing`. Its configuration order remains `configure terminal`, the engineer interface command, `switchport trunk allowed vlan add` with the engineer VLAN list, and `end`. Its rollback strategy remains `remove_only_new_addition`.

## States

`GENERATED` means the task, workflow, phases, rendered commands, sources, platform boundary, activity, rollback, and support metadata are present and aligned. `procedureGenerated` is true only in that state. `deviceExecutionAuthorized` is false. `GENERATED` does not mean the procedure was lab tested or is safe to enter on a device.

| Condition | State |
| --- | --- |
| Command-only task, or no workflow | `UNSUPPORTED`, reason `procedure_not_established` |
| Rendering is not `RENDERED`, or inputs are not `READY` | `UPSTREAM_NOT_RENDERED` |
| Activity evidence is missing or not one of the established values | `DATA_ERROR` |
| A step, source, platform boundary, rollback strategy, or phase/step alignment is missing | `INCOMPLETE_PROCEDURE` |

The result contains no procedure sections unless the state is `GENERATED`.
