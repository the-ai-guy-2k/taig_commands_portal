# Cisco task-to-command research package

ACI: ACI-TAIG2K-CISCO-COMMAND-KNOWLEDGE-RESEARCH-001
Dataset 0.1.0 / schema 1.0.0 / research date 2026-10-01
Status: PARTIAL. Documentation-reviewed; no device testing.

## Files

- Cisco_Command_Knowledge_Research_Report.md — findings and recommendations.
- Cisco_Command_Dataset.json — self-contained normalized entities and command records.
- Cisco_Task_Intent_Taxonomy.json — navigation proposal and populated task aliases.
- Cisco_Task_Workflows.json — ordered phases, parameters, expectations and recovery advice.
- Cisco_Source_Index.json — authoritative source URLs and release boundaries.
- Cisco_Coverage_Known_Gaps_Report.md — human-readable coverage and partitions.
- Cisco_Coverage_Known_Gaps.json — machine-readable coverage/backlog.
- Cisco_Command_Dataset.schema.json — current JSON Schema contract.
- MANIFEST.json — file sizes, SHA-256 hashes and validation summary.

The standalone taxonomy/workflow/source files are projections of the canonical dataset, not separate editable authorities. Change canonical entities and regenerate projections to avoid drift.

## Later ingestion

1. Parse UTF-8 JSON and validate against the schema. Check schema_version before accepting records.
2. Index commands, tasks, categories, sources and workflows by their immutable IDs. Verify all foreign keys.
3. Filter by the record's documented platform/release boundary before recommending syntax. Unknown target context requires qualification. Never infer current support from a legacy source.
4. Search task titles and aliases, then traverse task → workflow → command → source. Do not return taxonomy-only backlog categories as completed answers.
5. Resolve phase commands using parameter_values and CLI modes. Angle brackets denote placeholders, square brackets optional elements; syntax_scope describes a bounded task form. Placeholders are not literal CLI input. Do not flatten ordered contexts into an unordered list.
6. Present prerequisites, source links, operational effect, verification expectations and workflow rollback alongside configuration. A future application must distinguish read-only diagnosis from changes and use its own authorization policy.
7. Keep documentation_reviewed_not_device_tested visible; no production auto-execution is supported by this package.

## Interpretation

- command_id identifies a bounded command form, not every spelling/optional argument.
- task_categories contain design-only/backlog groups; seed_partial means some records exist.
- expected_output identifies evidence, not guaranteed values.
- prerequisites and decision branches are authored research synthesis; source-specific facts remain linked.
- negation_removal is a documented removal/default form or null; it is not an exact restoration promise.
- deprecated_status=not_established means not researched, not “current forever.”
- Multi-release and unpinned sources require narrower support qualification.

## Update discipline

Do not combine IOS, IOS XE, NX-OS, IOS XR or ASA merely because a command resembles another. Add explicit applicability variants when syntax/behavior differs. Preserve dates and old evidence. Use reproducible source inventories to claim any future complete partition. No web application, production code, device connection or configuration was created during this research.

## Saved destination

24. Kobe Folder → 03. TAIG2K SOFTWARE CENTER → Cisco Command Assistance App — K → Research → Cisco Command Knowledge → Results.

Results folder: https://drive.google.com/drive/folders/1KNeVB8r0R2iiAwe-tsDmAtcathPW4gv4
