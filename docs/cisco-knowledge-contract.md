# Verified Cisco knowledge contract

ACI: ACI-TAIG-COMMAND-PORTAL-001
Source package inspected: `cisco_command_results/Results`
Dataset: 0.1.0
Schema: 1.0.0
Research ACI: ACI-TAIG2K-CISCO-COMMAND-KNOWLEDGE-RESEARCH-001
Generated: 2026-10-01
Package status: PARTIAL
`completeness_claim`: false
`lab_validation`: false

This document records the structures and relationships that are actually present. It does not upgrade partial research into complete Cisco coverage.

## Package layout

The directory named by the ACI, `cisco_command_results`, contains one child directory, `Results`. The knowledge files live in that child. A zip archive, `Cisco_Command_Knowledge_Results_2026-10-01.zip`, is also in `Results`. It is not listed in `MANIFEST.json` and the loader does not read it.

| File | Role |
| --- | --- |
| `Cisco_Command_Dataset.json` | Canonical document |
| `Cisco_Command_Dataset.schema.json` | JSON Schema draft 2020-12 for the canonical document, with deep constraints only on metadata and command records |
| `Cisco_Task_Intent_Taxonomy.json` | Exact projection of `metadata`, `task_categories`, and `tasks` |
| `Cisco_Task_Workflows.json` | Exact projection of `metadata`, `task_workflows`, and `relationships` |
| `Cisco_Source_Index.json` | Exact projection of `metadata` and `sources` |
| `Cisco_Coverage_Known_Gaps.json` | Separate coverage and known-gap document. It is not a projection of a dataset array |
| `MANIFEST.json` | Shared metadata, research self-check notes, file sizes, and SHA-256 hashes |
| `README.md` | Research interpretation |
| `Cisco_Command_Knowledge_Research_Report.md` | Research findings |
| `Cisco_Coverage_Known_Gaps_Report.md` | Human-readable coverage table |

The three projection files were compared to the canonical dataset after parsing. Their shared collections and metadata objects are deeply equal. The research README states that those files are generated projections, not separate editable authorities. The loader treats the dataset as canonical and fails if a projection drifts.

`MANIFEST.json` metadata is deeply equal to the dataset metadata. Declared counts match the arrays: 100 commands, 12 workflows, 29 sources, 55 feature groups.

## What the supplied schema actually constrains

`$id`: `urn:taig:cisco-command-dataset:1.0.0`
`$schema`: `https://json-schema.org/draft/2020-12/schema`

The schema requires these dataset root keys:

`metadata`, `commands`, `task_categories`, `tasks`, `command_families`, `task_workflows`, `relationships`, `sources`, `platform_version_metadata`

It requires `metadata.schema_version`, `metadata.dataset_version`, and `metadata.completeness_claim`, and it consts `completeness_claim` to false.

Command items require `command_id`, `syntax`, `canonical_family`, `task_ids`, `task_category_id`, `cli_modes`, `syntax_elements`, `source_ids`, `support_status`, `validation_status`, `operational_risk`, `negation_removal`, and `expected_output`.

Schema constants on every command:

- `support_status` = `documented_in_source_boundary_only`
- `validation_status` = `documentation_reviewed_not_device_tested`

`syntax_elements` items require `name`, `description`, `required`, and `range`, but the schema does not type those fields. `negation_removal` is `string | null`. `operational_risk` requires `effect`, `level`, and `caution` without further types. `additionalProperties` is not disabled, and the real command records contain many fields the schema does not mention.

The schema types the other root collections only as arrays, and `platform_version_metadata` only as an object. Tasks, workflows, relationships, sources, families, coverage, and manifest hashes are not schema-constrained. Those checks are an application integrity layer built from the observed records. They are not additional claims inside the supplied schema.

## Canonical collections

| Collection | Count | Identifier |
| --- | ---: | --- |
| `task_categories` | 66 | `category_id` |
| `tasks` | 48 | `task_id` |
| `command_families` | 26 | `family_id` |
| `commands` | 100 | `command_id` |
| `task_workflows` | 12 | `workflow_id` |
| `relationships` | 131 | none; identity is the tuple `(workflow_id, type, from_id, to_id)` |
| `sources` | 29 | `source_id` |

No duplicate primary identifiers are present.

### Categories

11 records have `type` `task_partition`, `parent_id` null, and `coverage_status` `design_only`. Their ids are `core`, `layer2`, `ip`, `igp`, `bgp`, `services`, `security`, `monitoring`, `qos`, `advanced`, and `troubleshooting`.

55 records have `type` `feature_task_group`, a parent partition id, and `coverage_status` `seed_partial` (25) or `backlog` (30). `metadata.taxonomy_feature_group_count` counts these 55 records, not the 66 categories.

### Tasks

Every task has `task_id`, `title`, `category_id`, `aliases`, `workflow_ids`, and `coverage_status`.

- 12 tasks have one workflow id and `coverage_status` `seed_partial`.
- 36 tasks have an empty `workflow_ids` array and `coverage_status` `command_only`.

Aliases exist on task records. They are not a separate alias index, and this capability does not resolve them.

### Commands

Every command carries the same key set, including syntax, modes, task and category ids, platform and software fields, syntax elements, risk, source ids, source evidence, verification and troubleshooting command ids, related command ids, and validation status.

Observed facts that the schema does not state:

- `entry_context` is null on all 100 commands.
- `syntax_elements[].range` is null on all 61 elements. No range grammar is encoded.
- `deprecated_status` is `not_established` on all 100 commands.
- `source_evidence[].evidence_level` is `documented_task_form` on all 100 commands.
- `platform_family` is a non-empty string array. Values are not only `Catalyst 9300`.
- `software_family` is `Cisco IOS XE` (87), `Cisco IOS` (8), or `Cisco IOS / IOS XE` (5).
- `operational_risk.effect` is one of `read_only`, `persistent_configuration`, `context_change`, `startup_configuration_write`, `filesystem_write`, `destructive`, `disruptive`.
- `operational_risk.caution` is either a string or null.
- `negation_removal` is either a string or null. Null means no removal form was established.

`command_id` identifies a bounded command form. `syntax` is that form. Angle brackets are placeholders. Square brackets around a single placeholder mark the optional form. In this package those markers agree with `syntax_elements`:

- placeholder names, in order, equal `syntax_elements[].name`
- `[<name>]` is exactly `required: false`
- a bare `<name>` is `required: true`

Two optional elements exist: `show-errors` / `interface`, and `dhcp-exclude` / `high`. The loader checks this agreement. It does not render a command line.

### Workflows

`phases` is an object, not a list. Every workflow has exactly these keys, each an array of steps:

`pre_check`, `configuration`, `verification`, `troubleshooting`

A step is `{ command_id, parameter_values, note }`. `note` is a string or null. `parameter_values` is an object whose keys are syntax-element names. Values in this package are strings or integers. Empty `configuration` is valid: five diagnostic workflows have no configuration steps.

`decision_branches` is an array of `{ condition, action }`. Seven workflows have an empty array. Five have branches.

`rollback` is `{ strategy, instructions }`. Strategies present: `none_read_only`, `restore_prior_values`, `remove_only_new_addition`, `restore_binding_and_entries`, `restore_captured_management_policy`, `restore_prior_pool_state`, `not_generic_restore`.

Every workflow `validation_status` is `documentation_reviewed_not_device_tested`.

### Relationships

Relationship types are exactly:

| Phase | Relationship `type` |
| --- | --- |
| `pre_check` | `uses_in_pre_check` |
| `configuration` | `uses_in_configuration` |
| `verification` | `uses_in_verification` |
| `troubleshooting` | `uses_in_troubleshooting` |

`from_id` is the workflow task id. `to_id` is a command id. `workflow_id` is the workflow id.

The 131 relationship tuples are unique and equal the set of phase steps. No command is repeated inside a single phase. Relationships do not preserve step order or parameter bindings. Ordered steps in `phases` are the procedure encoding. Relationships are the use-set projection of those steps.

### Sources

Every source has `source_id`, `title`, `url`, `publisher`, `source_type`, `platform_boundary`, `release_boundary`, `retrieved_at`, `evidence_ref`, `review_scope`, and `notes`. `notes` may be an empty string.

`source_type` values: `configuration_guide` (13), `command_reference` (12), `troubleshooting` (2), `catalog` (2).

Release boundaries are record-specific. They include `IOS XE 17.15.x`, `IOS XE 17.x`, `IOS 12.4`, and several unpinned or multi-release labels. A shared command spelling is not a shared platform boundary.

### Platform metadata

```json
{
  "primary_boundary": {
    "platform": "Catalyst 9300",
    "software": "IOS XE",
    "release": "17.15.x"
  },
  "excluded_software": ["NX-OS", "ASA", "IOS XR"],
  "selection_rule": "Exact source boundary first; never infer compatibility from a shared command spelling.",
  "null_policy": "Unknown or not established; null is not false."
}
```

Per-command `platform_family`, `software_family`, and `version_notes`, per-workflow `platform_boundary`, and per-source `platform_boundary` / `release_boundary` remain separate. The primary boundary does not override a legacy or unpinned record.

### Families

Each family lists `command_ids` and `source_ids`. In this package, `command_ids` matches the set of commands whose `canonical_family` equals `family_id`. All 26 families are `seed_partial`.

## Coverage and known gaps

`Cisco_Coverage_Known_Gaps.json` contains `metadata`, `coverage`, `next_partition`, and `unresolved`.

`coverage` has 55 objects, one per feature group. Each has `category_id`, `label`, `status`, `command_count`, `workflow_count`, and `command_ids`.

Verified alignment:

- `category_id` and `label` match the feature group
- `status` matches `task_categories[].coverage_status`
- `command_ids` matches commands whose `task_category_id` is that category
- `command_count` matches `command_ids.length`
- `workflow_count` matches workflows whose `task_category_id` is that category

Coverage command ids are the commands primarily categorized there. They are not the commands used by a workflow in that category. Workflows routinely include commands from other categories, such as `conf`, `interface`, `exit`, and `end`.

`unresolved` is an array of six non-empty strings. There is no known-gap identifier. `next_partition` is one object with `priority`, `name`, and `acceptance_criteria`.

Task partitions are not coverage rows.

## Reference rules the loader enforces

These rules hold for the inspected package. A violation fails the load. The loader does not fill in a missing id, workflow, command, source, or parameter.

- Primary ids are unique.
- Category parents, task categories, command categories, and workflow categories resolve.
- Task `workflow_ids` resolve, and each workflow is listed on its task.
- Workflow `task_category_id` equals the task category.
- Command `task_ids`, family command ids, phase `command_id`, relationship endpoints, and verification, troubleshooting, and related command ids resolve.
- Command, workflow, family, and source-evidence source ids resolve.
- Every command `source_id` has a `source_evidence` entry, and every evidence source id is also a `source_id`.
- Syntax placeholders, optional bracket markers, and `syntax_elements` agree.
- Workflow `parameter_values` keys are syntax-element names. Required elements are present. Unknown names are rejected.
- Relationship tuples match the phase-step use set.
- Family membership matches `canonical_family`.
- Coverage rows match feature groups, labels, status, primary-category commands, and workflow counts.
- Projection collections match the dataset.
- Metadata objects match across the JSON knowledge files and the manifest.
- Manifest size and SHA-256 match the listed files. The manifest lists the other knowledge files and does not list or hash itself.
- Schema `$id`, when present, ends with `:` plus `schema_version`.
- A task with any workflow id is `seed_partial`. A task with no workflow id is `command_only`.

## Application concepts and source fields

The loader keeps source field names. The mapping below is how application concepts read those fields. It is not a rename.

| Application concept | Source encoding |
| --- | --- |
| Task | `tasks[]` |
| Workflow | `task_workflows[]` |
| Required input | `commands[].syntax_elements[]` where `required` is true. Workflow `parameter_values` are research bindings, not a user-input schema |
| Command | `commands[]` |
| Step | `task_workflows[].phases.<phase>[]`, in phase order `pre_check`, `configuration`, `verification`, `troubleshooting` |
| Verification | `phases.verification`, `commands[].verification_command_ids`, `commands[].expected_output`, and `task_workflows[].expected_results` |
| Source | `sources[]`, plus `source_ids` and `source_evidence` |
| Platform / context | `platform_version_metadata`, command platform/software/version fields, `workflow.platform_boundary`, and source platform/release boundaries |
| Coverage | `coverage[]`, aligned to feature groups |
| Warning | No single warning entity. Cautions live on `operational_risk.caution`, command `notes`, and `validation_status` |
| Known gap | Feature groups with `backlog`, coverage rows with that status, and the `unresolved` string list |

`entry_context` is not a usable context model in this package. It is present and null.

## Relationships that are not in the package

- There is no separate alias document.
- There is no device, credential, or lab-result record.
- There is no rendered CLI string with parameters already substituted.
- There is no ordered relationship list independent of `phases`.
- There is no coverage percentage or complete-command denominator.
- There is no known-gap id, and unresolved items do not point at task or command ids.
- Markdown reports are hashed by the manifest. They are not a second structured contract.
- The zip archive is not a manifest member.

## Failure behavior

`loadKnowledgePackage` returns `{ ok: false, errors }` when any material check fails. It does not return a partial knowledge object. Error codes used by this contract:

`MISSING_FILE`, `INVALID_JSON`, `SCHEMA_MISMATCH`, `DUPLICATE_IDENTIFIER`, `MISSING_REFERENCED_TASK`, `MISSING_REFERENCED_WORKFLOW`, `MISSING_REFERENCED_COMMAND`, `MALFORMED_COMMAND`, `UNRESOLVED_REFERENCE`, `INVALID_TEMPLATE_METADATA`, `MISSING_SOURCE_REFERENCE`, `MALFORMED_COVERAGE`, `MALFORMED_KNOWN_GAP`, `INCONSISTENT_MANIFEST`, `INTERNAL_INCONSISTENCY`

One defect can produce more than one code. Manifest `validation` strings are stored and are not treated as a pass.

## Exact-id trace

`traceTask(knowledge, taskId)` walks one loaded task by exact `task_id`:

task → category → coverage row when the category is a feature group → workflow → ordered phase steps → command record → source records and verification, troubleshooting, and related command records

It returns the syntax template and the recorded `parameter_values` separately. It does not search aliases and does not substitute parameters. An unknown id is `UNRESOLVED_REFERENCE`.
