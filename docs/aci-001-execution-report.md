# ACI-TAIG-COMMAND-PORTAL-001 execution report

Capability: Knowledge Contract & Loader Foundation
Status: PASS, pending XNQEN acceptance of this evidence
Branch: `feature/aci-001-knowledge-loader`
Commit: the commit that contains this report. The SHA is returned with the ACI execution record.

## Source files inspected

Directory `cisco_command_results` contains only `Results/`.

| File | Bytes |
| --- | ---: |
| `Results/Cisco_Command_Dataset.json` | 353622 |
| `Results/Cisco_Command_Dataset.schema.json` | 3327 |
| `Results/Cisco_Command_Knowledge_Research_Report.md` | 7285 |
| `Results/Cisco_Command_Knowledge_Results_2026-10-01.zip` | 56149 |
| `Results/Cisco_Coverage_Known_Gaps.json` | 14855 |
| `Results/Cisco_Coverage_Known_Gaps_Report.md` | 4870 |
| `Results/Cisco_Source_Index.json` | 18026 |
| `Results/Cisco_Task_Intent_Taxonomy.json` | 27448 |
| `Results/Cisco_Task_Workflows.json` | 58975 |
| `Results/MANIFEST.json` | 2505 |
| `Results/README.md` | 3636 |

The zip is not a manifest member and is not loaded. A second archive, `Results-20261001T191853Z-1-001.zip`, sits in the project root outside `cisco_command_results`. It is not a loader input and is not part of this commit.

## Verified source relationships

Canonical document: `Cisco_Command_Dataset.json` (100 commands, 48 tasks, 12 workflows, 131 relationships, 29 sources, 66 categories, 26 families).

Taxonomy, workflow, and source files are exact projections of the matching dataset collections plus the same metadata object. Coverage is a separate file with 55 feature-group rows. Relationship tuples match the workflow phase-step use set. Syntax placeholders match `syntax_elements`. Workflow parameter names match those elements. Manifest metadata matches the dataset, and file sizes and SHA-256 hashes match the bytes on disk.

Full mapping: `docs/cisco-knowledge-contract.md`.

## Unresolved source relationships

These are absent from the package, not loader defects:

- 36 tasks are `command_only` and have no workflow.
- `entry_context` is null on every command.
- `syntax_elements[].range` is null on every element. No range grammar is encoded.
- Coverage `command_ids` are primary-category membership, not the commands a workflow uses.
- `unresolved` is a string list with no task, workflow, or command ids.
- The supplied JSON Schema does not constrain tasks, workflows, relationships, sources, families, or coverage beyond container types.
- No device or lab evidence exists. `lab_validation` is false and `completeness_claim` is false.

## Files created

Project foundation:

- `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `next-env.d.ts`
- `.gitignore`, `.gitattributes`
- `README.md`
- `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

Knowledge loader:

- `lib/knowledge/constants.ts`
- `lib/knowledge/types.ts`
- `lib/knowledge/errors.ts`
- `lib/knowledge/guards.ts`
- `lib/knowledge/deep-equal.ts`
- `lib/knowledge/read-package.ts`
- `lib/knowledge/schema.ts`
- `lib/knowledge/integrity.ts`
- `lib/knowledge/indexes.ts`
- `lib/knowledge/trace.ts`
- `lib/knowledge/load.ts`
- `lib/knowledge/index.ts`

Tests and evidence:

- `tests/fixture-package.ts`
- `tests/knowledge-loader.test.ts`
- `docs/cisco-knowledge-contract.md`
- `docs/candidate-initial-tasks.md`
- `docs/aci-001-execution-report.md`

The authoritative research files under `cisco_command_results/Results` are included so the loader and tests read the same package. No research file was modified.

## Tests executed

Command: `npm test` (`vitest run`)
Result: 19 passed, 0 failed.

Positive:

- Load `cisco_command_results/Results` with schema 1.0.0, dataset 0.1.0, 100 commands, 12 workflows, 48 tasks, 29 sources, 55 coverage rows.
- Trace `task-locate-mac` → workflow `locate-mac` → verification steps `mac-address`, `mac-interface`, `show-status` → command syntax `show mac address-table address <mac>` → source `S07` → coverage category `mac` / `seed_partial`.
- Parameter binding `{ mac: "0011.2233.4455" }` stays separate from syntax. No rendered command field is added.
- Alias text is not accepted as a task id.
- A minimal valid fixture loads.

Negative fixtures, each failing closed with the listed code present:

| Case | Code |
| --- | --- |
| Missing dataset file | `MISSING_FILE` |
| Invalid workflow JSON | `INVALID_JSON` |
| Command missing `syntax` | `SCHEMA_MISMATCH` |
| Duplicate `command_id` | `DUPLICATE_IDENTIFIER` |
| Command `task_ids` entry missing | `MISSING_REFERENCED_TASK` |
| Task workflow id missing | `MISSING_REFERENCED_WORKFLOW` |
| Phase command id missing | `MISSING_REFERENCED_COMMAND` |
| `verification_command_ids` not an array | `MALFORMED_COMMAND` |
| Task category id missing | `UNRESOLVED_REFERENCE` |
| Workflow parameter name not a syntax element | `INVALID_TEMPLATE_METADATA` |
| Command source id missing from the source index | `MISSING_SOURCE_REFERENCE` |
| Coverage command id set does not match the category | `MALFORMED_COVERAGE` |
| `unresolved` is not a string array | `MALFORMED_KNOWN_GAP` |
| Manifest SHA-256 does not match file bytes | `INCONSISTENT_MANIFEST` |
| Taxonomy title changed apart from the dataset | `INTERNAL_INCONSISTENCY` |

`npx tsc --noEmit` completed with exit code 0. The home page was loaded at `http://localhost:3000` and rendered load status Passed, schema 1.0.0, dataset 0.1.0, status PARTIAL, completeness claim false, 100 commands, 12 workflows, and 29 sources.

## Candidate tasks

Recommended first slice: `task-locate-mac`, `task-interface-drops`, `task-lacp-check`, and `task-add-trunk-vlan`. Evidence is in `docs/candidate-initial-tasks.md`.

## Known gaps

The research package is PARTIAL. No feature group is complete. DHCP, SSH, OSPF, BGP, extended ACL, and save/backup workflows are traversable but are outside the recommended first slice because their source boundaries are mixed, legacy, unpinned, or write-oriented. See the candidate report.

## Architecture observations

The loader keeps four stages: read bytes and parse JSON, validate the supplied draft 2020-12 schema, validate observed structure and references, then expose indexes and an exact-id trace. Business logic is in `lib/knowledge`. The home page only displays load status and package identity.

Projections are checked for equality with the dataset. They are not treated as a second source of engineering truth.

`traceTask` requires an exact `task_id`. It does not search aliases, choose among workflows, substitute parameters, or render a procedure.

## Minority Report

NONE.

The partial schema and partial coverage match the research package and the GVCA-ACICE deterministic, guidance-only posture. They do not require an architecture change or a forecast change.

## Recommended input to ACI-002

Task catalog and task resolution should:

- Resolve only exact task records and, separately, documented aliases. Do not treat a taxonomy backlog category as a completed answer.
- Follow `task.workflow_ids` and ordered `phases`. Do not treat coverage `command_ids` as the workflow command list.
- Keep `seed_partial`, per-step platform and release boundaries, and `documentation_reviewed_not_device_tested` visible.
- Start with `task-locate-mac`, `task-interface-drops`, `task-lacp-check`, and `task-add-trunk-vlan`.
- Leave `command_only` tasks without a workflow out of procedure generation.
- Leave parameter substitution and procedure rendering to their own later capability. This loader does not do that work.
