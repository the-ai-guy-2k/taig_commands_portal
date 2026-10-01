# Failure and coverage UX

Capability 9 presents backend states in engineer language. It does not change task identity, input contracts, validation rules, workflows, rendering, or procedure generation. `lib/coverage/present.ts` is the only mapping from those states to headlines, explanations, and next actions. The React components render that mapping.

A generated procedure is an application result. It is not a device test, a production-ready claim, or permission to run commands.

## Backend state to UI state

| Backend state | Category | Headline | Procedure stays visible | Next action |
| --- | --- | --- | --- | --- |
| Package `PARTIAL` | information | Package coverage | Not a procedure | Read the limit. It is not a load failure. |
| `WORKFLOW_BACKED` / `seed_partial` | information | Workflow-backed task. Coverage is partial. | No, until generation | Enter required inputs and generate. |
| `WORKFLOW_NOT_ESTABLISHED` | attention | This task is known. Workflow not established. | No | Keep the task command-only, or select a workflow-backed task. |
| `NEEDS_INPUT` | attention | Required information is missing | No | Supply the named fields. |
| `INVALID_INPUT` | attention | A supplied value violates an established rule | No | Use only the backend reason. |
| `CONFLICT` | attention | The supplied inputs conflict | No | Resolve the listed conflict. |
| `UNSUPPORTED_VALIDATION` | attention | Validation is not established | No | Do not treat the value as invalid. |
| `READY` | information | Required inputs are present | No | Generate. Ready is not device authorization. |
| `GENERATED` | application | Procedure generated as guidance | Yes | Read it as guidance. |
| `AMBIGUOUS` | attention | More than one task matched | No | Select one candidate. None is preferred. |
| `UNSUPPORTED` / `no_match` | attention | No matching catalog task | No | Choose a catalog task. |
| `UNSUPPORTED` / `excluded_software` | blocking | This software context is excluded | No | Stay inside the package boundary. |
| `DATA_ERROR` | blocking | Knowledge data could not be validated | No | Reload after the package is restored. |
| `INCOMPLETE_PROCEDURE` | blocking | The procedure failed completeness checks | No | Do not use the result as a procedure. |
| `UPSTREAM_NOT_READY` | blocking | An earlier step was not ready | No | Correct the earlier condition. |
| `UPSTREAM_NOT_RENDERED` | blocking | Commands were not rendered | No | No procedure is shown. |
| `NO_MATCHES` | information | No matching catalog task | No | Change the search. No close match is chosen. |
| Loader failure | blocking | The knowledge base did not load safely | No | This is not an empty search. |

## Package coverage semantics

The package panel states `PARTIAL`, completeness claim `false`, lab validation `false`, `documentation_reviewed_not_device_tested`, the primary boundary Catalyst 9300 / IOS XE 17.15.x, and excluded software NX-OS, ASA, and IOS XR. False completeness and false lab validation are described as deliberate limits. They are not presented as an application crash.

## Validation-state language

`NEEDS_INPUT` names the missing keys and the task, and the same message is attached to each empty required field.

`INVALID_INPUT` repeats the backend message. The UI does not add VLAN ranges, MAC formats, or interface grammar.

`UNSUPPORTED_VALIDATION` says the portal does not have enough authoritative rule data. The value is not marked invalid, and the field is not given `aria-invalid` for that state. A declared range that the backend marks `declared_unevaluable` is named as a constraint that cannot be evaluated.

## Command-only state

A command-only task stays selectable. The notice says the task is known, command knowledge may exist, the workflow is not established, and a procedure is not available. No form and no Generate control are shown. Tagged commands are not turned into a procedure.

## Unsupported state

`no_match` means no catalog identity matched. `excluded_software` means the software context is outside the package. Those headlines stay different. Catalog search does not call task resolution, so a search miss stays `NO_MATCHES` and does not invent a task.

`AMBIGUOUS` lists every returned candidate and tells the engineer to select one. The presenter does not choose a candidate. The live catalog selects by the stable task id on the button, so search text is not resolved.

## Data-error state

`DATA_ERROR` is a hard stop. The notice says procedure generation cannot continue, includes the diagnostic code and message, and does not show a procedure. A loader failure uses a separate headline and says it is not the same as a search with no matches. The catalog is not replaced with an empty list.

## Incomplete-procedure state

`INCOMPLETE_PROCEDURE` is blocking. The failure message is shown. The result is not labeled as a generated procedure. `deviceExecutionAuthorized` remains false.

## Known-gap treatment

Known gaps stay in a disclosure under the procedure. The summary shows the count and says they are coverage limitations, not additional warnings. Source-backed cautions remain in the warnings section.

## Source and platform boundary handling

Each source keeps its own platform and release text. When that text does not include the package primary software and release, the view says the source boundary is recorded separately and is not rewritten to the primary release.

## Stale results

A new validation failure, blocked result, or data error replaces the previous run. The procedure view renders only a `GENERATED` result, so a failed request does not leave the previous procedure on screen.

## ACI-010 handoff

ACI-010 is Regression, Versioning, Health, and MVP Deployment. This capability does not add deployment architecture, health probes, or version migration.
