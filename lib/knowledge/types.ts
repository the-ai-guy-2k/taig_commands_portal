import type { PhaseName, RelationshipType } from "./constants";

export interface PackageMetadata {
  aci: string;
  schema_version: string;
  dataset_version: string;
  generated_at: string;
  status: string;
  completeness_claim: boolean;
  coverage_boundary: string;
  command_count: number;
  workflow_count: number;
  taxonomy_feature_group_count: number;
  source_count: number;
  lab_validation: boolean;
}

export interface TaskCategory {
  category_id: string;
  parent_id: string | null;
  label: string;
  type: string;
  coverage_status: string;
}

export interface TaskRecord {
  task_id: string;
  title: string;
  category_id: string;
  aliases: string[];
  workflow_ids: string[];
  coverage_status: string;
}

export interface CommandFamily {
  family_id: string;
  label: string;
  command_ids: string[];
  source_ids: string[];
  coverage_status: string;
}

export interface SyntaxElement {
  name: string;
  description: string;
  required: boolean;
  range: string | null;
}

export interface OperationalRisk {
  effect: string;
  level: string;
  caution: string | null;
}

export interface SourceEvidence {
  source_id: string;
  section: string;
  evidence_level: string;
}

export interface CommandRecord {
  command_id: string;
  command: string;
  canonical_family: string;
  task_ids: string[];
  task_category_id: string;
  technology: string;
  intent: string;
  platform_family: string[];
  software_family: string;
  version_notes: string;
  device_feature_context: string;
  cli_modes: string[];
  entry_context: string | null;
  syntax: string;
  syntax_scope: string;
  syntax_elements: SyntaxElement[];
  description: string;
  when_to_use: string;
  prerequisites: string[];
  example: string;
  example_type: string;
  verification_command_ids: string[];
  expected_output: string[];
  troubleshooting_command_ids: string[];
  related_command_ids: string[];
  negation_removal: string | null;
  rollback_notes: string;
  operational_risk: OperationalRisk;
  source_ids: string[];
  source_evidence: SourceEvidence[];
  source_version: string;
  aliases: string[];
  deprecated_status: string;
  support_status: string;
  validation_status: string;
  last_reviewed: string;
  notes: string[];
}

export interface WorkflowStep {
  command_id: string;
  parameter_values: Record<string, unknown>;
  note: string | null;
}

export interface WorkflowPhases {
  pre_check: WorkflowStep[];
  configuration: WorkflowStep[];
  verification: WorkflowStep[];
  troubleshooting: WorkflowStep[];
}

export interface DecisionBranch {
  condition: string;
  action: string;
}

export interface WorkflowRollback {
  strategy: string;
  instructions: string[];
}

export interface TaskWorkflow {
  workflow_id: string;
  task_id: string;
  title: string;
  task_category_id: string;
  intent_aliases: string[];
  platform_boundary: string;
  prerequisites: string[];
  phases: WorkflowPhases;
  expected_results: string[];
  decision_branches: DecisionBranch[];
  rollback: WorkflowRollback;
  source_ids: string[];
  authorship: string;
  validation_status: string;
}

export interface RelationshipRecord {
  from_id: string;
  to_id: string;
  type: RelationshipType | string;
  workflow_id: string;
}

export interface SourceRecord {
  source_id: string;
  title: string;
  url: string;
  publisher: string;
  source_type: string;
  platform_boundary: string;
  release_boundary: string;
  retrieved_at: string;
  evidence_ref: string;
  review_scope: string;
  notes: string;
}

export interface PlatformBoundary {
  platform: string;
  software: string;
  release: string;
}

export interface PlatformVersionMetadata {
  primary_boundary: PlatformBoundary;
  excluded_software: string[];
  selection_rule: string;
  null_policy: string;
}

export interface DatasetDocument {
  metadata: PackageMetadata;
  task_categories: TaskCategory[];
  tasks: TaskRecord[];
  command_families: CommandFamily[];
  commands: CommandRecord[];
  task_workflows: TaskWorkflow[];
  relationships: RelationshipRecord[];
  sources: SourceRecord[];
  platform_version_metadata: PlatformVersionMetadata;
}

export interface TaxonomyDocument {
  metadata: PackageMetadata;
  task_categories: TaskCategory[];
  tasks: TaskRecord[];
}

export interface WorkflowsDocument {
  metadata: PackageMetadata;
  task_workflows: TaskWorkflow[];
  relationships: RelationshipRecord[];
}

export interface SourceIndexDocument {
  metadata: PackageMetadata;
  sources: SourceRecord[];
}

export interface CoverageItem {
  category_id: string;
  label: string;
  status: string;
  command_count: number;
  workflow_count: number;
  command_ids: string[];
}

export interface NextPartition {
  priority: number;
  name: string;
  acceptance_criteria: string[];
}

export interface CoverageDocument {
  metadata: PackageMetadata;
  coverage: CoverageItem[];
  next_partition: NextPartition;
  unresolved: string[];
}

export interface ManifestFileEntry {
  filename: string;
  size_bytes: number;
  sha256: string;
}

export interface ManifestDocument {
  metadata: PackageMetadata;
  validation: Record<string, unknown>;
  files: ManifestFileEntry[];
}

export interface SchemaDocument {
  $schema?: string;
  $id?: string;
  [key: string]: unknown;
}

export interface KnowledgeIndexes {
  categoriesById: ReadonlyMap<string, TaskCategory>;
  tasksById: ReadonlyMap<string, TaskRecord>;
  workflowsById: ReadonlyMap<string, TaskWorkflow>;
  commandsById: ReadonlyMap<string, CommandRecord>;
  sourcesById: ReadonlyMap<string, SourceRecord>;
  familiesById: ReadonlyMap<string, CommandFamily>;
  coverageByCategoryId: ReadonlyMap<string, CoverageItem>;
  commandsCitingTask: ReadonlyMap<string, readonly CommandRecord[]>;
}

export interface LoadedKnowledge {
  directory: string;
  manifest: ManifestDocument;
  dataset: DatasetDocument;
  taxonomy: TaxonomyDocument;
  workflows: WorkflowsDocument;
  sourceIndex: SourceIndexDocument;
  coverage: CoverageDocument;
  schema: SchemaDocument;
  indexes: KnowledgeIndexes;
}

export interface TraceStep {
  phase: PhaseName;
  relationshipType: RelationshipType;
  command_id: string;
  parameter_values: Record<string, unknown>;
  note: string | null;
  command: CommandRecord;
  sources: SourceRecord[];
  verificationCommands: CommandRecord[];
  troubleshootingCommands: CommandRecord[];
  relatedCommands: CommandRecord[];
}

export interface WorkflowTrace {
  workflow: TaskWorkflow;
  phases: Array<{
    phase: PhaseName;
    relationshipType: RelationshipType;
    steps: TraceStep[];
  }>;
}

export interface TaskTrace {
  task: TaskRecord;
  category: TaskCategory;
  coverage: CoverageItem | null;
  workflows: WorkflowTrace[];
  commandsCitingTask: readonly CommandRecord[];
}
