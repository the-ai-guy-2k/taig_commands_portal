export const KNOWLEDGE_DIRECTORY_CANDIDATE = "Results";

export const REQUIRED_JSON_FILES = {
  dataset: "Cisco_Command_Dataset.json",
  schema: "Cisco_Command_Dataset.schema.json",
  taxonomy: "Cisco_Task_Intent_Taxonomy.json",
  workflows: "Cisco_Task_Workflows.json",
  sources: "Cisco_Source_Index.json",
  coverage: "Cisco_Coverage_Known_Gaps.json",
  manifest: "MANIFEST.json",
} as const;

export const REQUIRED_JSON_FILENAMES = [
  REQUIRED_JSON_FILES.dataset,
  REQUIRED_JSON_FILES.schema,
  REQUIRED_JSON_FILES.taxonomy,
  REQUIRED_JSON_FILES.workflows,
  REQUIRED_JSON_FILES.sources,
  REQUIRED_JSON_FILES.coverage,
  REQUIRED_JSON_FILES.manifest,
] as const;

export const PHASE_NAMES = [
  "pre_check",
  "configuration",
  "verification",
  "troubleshooting",
] as const;

export type PhaseName = (typeof PHASE_NAMES)[number];

export const PHASE_RELATIONSHIP_TYPE = {
  pre_check: "uses_in_pre_check",
  configuration: "uses_in_configuration",
  verification: "uses_in_verification",
  troubleshooting: "uses_in_troubleshooting",
} as const;

export type RelationshipType =
  (typeof PHASE_RELATIONSHIP_TYPE)[PhaseName];

export const RELATIONSHIP_TYPES = Object.values(PHASE_RELATIONSHIP_TYPE);

export const CATEGORY_TYPES = ["task_partition", "feature_task_group"] as const;

export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const TASK_COVERAGE_WITH_WORKFLOW = "seed_partial";
export const TASK_COVERAGE_WITHOUT_WORKFLOW = "command_only";

export const PARTITION_COVERAGE_STATUS = "design_only";
export const FEATURE_COVERAGE_STATUSES = ["seed_partial", "backlog"] as const;

export const DOCUMENTED_NOT_DEVICE_TESTED =
  "documentation_reviewed_not_device_tested";

export const DATASET_ROOT_KEYS = [
  "metadata",
  "task_categories",
  "tasks",
  "command_families",
  "commands",
  "task_workflows",
  "relationships",
  "sources",
  "platform_version_metadata",
] as const;

export const COMMAND_KEYS = [
  "command_id",
  "command",
  "canonical_family",
  "task_ids",
  "task_category_id",
  "technology",
  "intent",
  "platform_family",
  "software_family",
  "version_notes",
  "device_feature_context",
  "cli_modes",
  "entry_context",
  "syntax",
  "syntax_scope",
  "syntax_elements",
  "description",
  "when_to_use",
  "prerequisites",
  "example",
  "example_type",
  "verification_command_ids",
  "expected_output",
  "troubleshooting_command_ids",
  "related_command_ids",
  "negation_removal",
  "rollback_notes",
  "operational_risk",
  "source_ids",
  "source_evidence",
  "source_version",
  "aliases",
  "deprecated_status",
  "support_status",
  "validation_status",
  "last_reviewed",
  "notes",
] as const;
