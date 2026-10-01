# Task catalog and resolution

ACI: ACI-TAIG-COMMAND-PORTAL-002
Depends on the accepted ACI-001 loader. This capability does not reload Cisco files from the page and does not generate procedures or rendered commands.

## Catalog model

`loadTaskCatalog` calls `loadKnowledgePackage`. If the loader fails, the catalog result is `DATA_ERROR` and no task is selected.

A successful catalog contains every task record in `Cisco_Command_Dataset.json`:

| Fact | Value in dataset 0.1.0 |
| --- | ---: |
| Cataloged tasks | 48 |
| Workflow-backed (`workflow_ids` present, `coverage_status` `seed_partial`) | 12 |
| Command-only (`workflow_ids` empty, `coverage_status` `command_only`) | 36 |
| Alias strings used for resolution | 56 |
| Distinct normalized alias keys | 56 |
| Cross-task alias collisions | 0 |

There is no separate task description field. The task name is `title`.

Workflow-backed does not mean a complete procedure exists. Every workflow-backed task in this package remains `seed_partial`, `documentation_reviewed_not_device_tested`, with package `completeness_claim` false and `lab_validation` false.

Command-only tasks stay in the catalog. Their workflow availability is `absent`. They are not relabeled as workflow-backed.

Each catalog task keeps:

- task id, title, and aliases
- category id, label, type, and category coverage status
- task `coverage_status`
- coverage-row status when the ACI-001 index has a row for that category
- workflow availability and, when present, workflow id, `platform_boundary`, rollback strategy, configuration-step count, and workflow `validation_status`
- package primary boundary and `excluded_software` on the catalog, not copied onto the task as a certified device claim

`configurationStepCount` is the length of `phases.configuration`. The catalog does not copy command ids, syntax, or parameter bindings.

### Activity evidence

This is derived only from workflow fields that are present:

| Evidence | Rule |
| --- | --- |
| `read_only` | Every linked workflow has an empty configuration phase and rollback strategy `none_read_only` |
| `configuration_changing` | Every linked workflow has at least one configuration step |
| `not_established` | No workflow, or the workflow fields disagree |

The three read-only proof tasks match `read_only`. `task-add-trunk-vlan` matches `configuration_changing` because its configuration phase has 4 steps and its rollback strategy is `remove_only_new_addition`. A command-only task such as `task-command-reload` resolves as a task and stays `not_established` because no workflow encodes activity.

### Initial proof set

These four ids are an application policy constant from the accepted ACI-001 candidate report. They are not a dataset field. Catalog presence of any other task does not add it to this set.

- `task-locate-mac`
- `task-interface-drops`
- `task-lacp-check`
- `task-add-trunk-vlan`

## Resolution precedence

Input is normalized, then matched in this order:

1. Exact task id
2. Exact task title
3. Exact alias
4. Otherwise `UNSUPPORTED`

Normalization is only:

- trim leading and trailing whitespace
- collapse repeated whitespace to a single space
- case-fold with `toLowerCase`

Punctuation, hyphens, and token edits are not normalized. `locate mac` does not resolve to `task-locate-mac`.

Aliases come from `tasks[].aliases`. If a linked workflow `intent_aliases` entry is not already one of those aliases, it is added for that same task. In dataset 0.1.0 every workflow `intent_aliases` array equals that task's `aliases`, so no extra aliases are added. Command aliases are not task aliases. A command can cite more than one task, and those strings are not used to choose a task.

If the normalized input matches one task at a stage, the result is `RESOLVED` and later stages are not consulted. A task id therefore wins over another task's alias that uses the same text. A title wins over an alias. Several command-only aliases normalize to that same task's title; those inputs resolve as `task_name`.

If one stage matches more than one task, the result is `AMBIGUOUS` and lists the task ids in sorted order. No candidate is selected. Dataset 0.1.0 has no such alias or title collision. Fixture tests cover the collision.

## Resolution states

| State | When |
| --- | --- |
| `RESOLVED` | One task matches the winning stage |
| `AMBIGUOUS` | The winning stage matches more than one task |
| `UNSUPPORTED` | No match, or the caller supplies a software or platform token that exactly matches `excluded_software` |
| `INVALID_INPUT` | The input is not a string, or it is empty after normalization |
| `DATA_ERROR` | The loader failed, a task record is malformed, a category or workflow reference does not resolve, or workflow presence disagrees with `coverage_status` |

`NX-OS`, `ASA`, and `IOS XR` are the excluded software values. `nx-os` is unsupported for that reason and does not return a resolved task. A platform string that is not in that list, such as another Catalyst model, does not become a silent rejection and does not become a support claim. The resolved task still carries the workflow `platform_boundary` and the catalog still carries the package primary boundary: Catalyst 9300 / IOS XE 17.15.x.

`task-dhcp-server` resolves, and its workflow boundary text still states legacy IOS 12.4 evidence. Resolution does not rewrite that boundary to the primary boundary.

## Application interface

| Operation | Behavior |
| --- | --- |
| `loadTaskCatalog` | Load through ACI-001, then build the catalog |
| `listTasks` | Catalog tasks sorted by task id |
| `listTaskCategories` | Categories sorted by category id, with task counts |
| `getTaskById` | Stable id only, after the same normalization. Aliases are not accepted |
| `resolveTask` | Full precedence, with optional `{ software, platform }` context |

`getTaskById` and `resolveTask` do not read the filesystem. They use a catalog produced by the loader.

## What this capability does not do

It does not render commands, substitute parameters, choose workflow steps, or build a procedure. Those remain later capabilities. Workflow ids and configuration-step counts establish support state only.
