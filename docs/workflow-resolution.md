# Workflow and command resolution

ACI: ACI-TAIG-COMMAND-PORTAL-004
Depends on the accepted loader, task resolver, and input validator. This capability does not render Cisco syntax, substitute engineer values into command templates, or generate a procedure.

## Ordering

`resolveWorkflow` walks each workflow linked from the catalog task, in that task's workflow list order.

Phases stay in this order:

1. `pre_check`
2. `configuration`
3. `verification`
4. `troubleshooting`

An empty phase remains in the result so verification is not flattened into the other phases. Steps inside a phase stay in workflow array order. They are not sorted alphabetically and they are not reordered from relationship records.

The 131 relationship edges are a use-set. The resolver checks that the set of phase relationship type plus command id matches the ordered steps. It does not read edge order as procedure order. A mismatch is `DATA_ERROR` with `RELATIONSHIP_MISMATCH`.

## Command resolution

Each step resolves `command_id` to the command record. The consumer result keeps command id, intent, platform family, software family, version notes, support and validation status, operational risk, source ids, and verification and troubleshooting command ids.

It does not copy `syntax`, `command`, or `example`. Those templates stay in the knowledge package. Verification command ids stay on the command reference. They are not inserted into the workflow phase list.

## Parameter bindings

Each workflow `parameter_values` entry is kept as `researchValue` with:

- `parameterName`
- `syntaxElementName`
- `engineerInputKey` from the Capability 3 contract

The engineer value accepted by Capability 3 is not copied and is not written into a command string. Substitution belongs to the next capability.

## Source provenance

Workflow `source_ids` and command `source_ids` resolve to source records. Each resolved source keeps its own title, platform boundary, release boundary, evidence reference, and review scope. Command sources also keep the matching `source_evidence` section and evidence level. A source release is not rewritten to the package primary boundary.

The package primary boundary remains `Catalyst 9300 / IOS XE 17.15.x`. A workflow such as `dhcp-server` keeps its own `IOS 12.4` boundary beside that primary boundary.

## Platform conflict

Command `software_family` and `platform_family` are compared only to package `excluded_software`, using the same trim, whitespace collapse, and case-fold used for task identity. An exact match is `CONFLICT` with `PLATFORM_CONFLICT`. The workflow is not returned. Other release strings are preserved and are not treated as conflicts, because this package has no rule that equates them.

## Coverage and known gaps

Coverage status, category status, the package `unresolved` list, and `next_partition.name` are copied as support state. Coverage `command_ids` are category membership. They are not copied into the resolved workflow and are not used as step order.

`completeness_claim` and `lab_validation` stay false for this package. Workflow-backed proof tasks stay `seed_partial`.

## Readiness and command-only tasks

Resolution of a workflow-backed task requires Capability 3 state `READY`. `NEEDS_INPUT`, `INVALID_INPUT`, `CONFLICT`, `UNSUPPORTED_VALIDATION`, and `DATA_ERROR` return `UPSTREAM_NOT_READY` and no steps.

A command-only task returns `WORKFLOW_NOT_ESTABLISHED`. Commands that cite the task are not assembled into phases, pre-checks, verification, rollback, or troubleshooting.

`RESOLVED` means the workflow and its command, source, and coverage references resolved. `commandsRendered`, `procedureGenerated`, and `deviceExecutionAuthorized` are false.

## Fail-closed references

These conditions return `DATA_ERROR` and no resolved workflow:

- missing workflow id
- workflow task id mismatch
- malformed phase or step
- missing or duplicate command id
- broken parameter binding
- missing source
- unresolved verification or troubleshooting command id
- coverage row that does not match its feature-group category
- relationship use-set that does not match the ordered steps
- malformed known-gap metadata
