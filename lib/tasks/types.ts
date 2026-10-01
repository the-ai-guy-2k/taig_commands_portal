export const RESOLUTION_STATES = [
  "RESOLVED",
  "AMBIGUOUS",
  "UNSUPPORTED",
  "INVALID_INPUT",
  "DATA_ERROR",
] as const;

export type ResolutionState = (typeof RESOLUTION_STATES)[number];

export type WorkflowAvailability = "present" | "absent";

export type ActivityEvidence = "read_only" | "configuration_changing" | "not_established";

export type MatchStage = "task_id" | "task_name" | "alias";

export interface PackageBoundary {
  platform: string;
  software: string;
  release: string;
}

export interface TaskWorkflowAvailability {
  workflowId: string;
  platformBoundary: string;
  rollbackStrategy: string;
  configurationStepCount: number;
  validationStatus: string;
}

export interface CatalogTask {
  taskId: string;
  title: string;
  aliases: readonly string[];
  categoryId: string;
  categoryLabel: string;
  categoryType: string;
  categoryCoverageStatus: string;
  coverageStatus: string;
  coverageRowStatus: string | null;
  workflowAvailability: WorkflowAvailability;
  workflows: readonly TaskWorkflowAvailability[];
  activityEvidence: ActivityEvidence;
  inInitialVerticalSlice: boolean;
  validationStatus: string | null;
}

export interface CatalogCategory {
  categoryId: string;
  label: string;
  type: string;
  parentId: string | null;
  coverageStatus: string;
  taskCount: number;
}

export interface TaskCatalogCounts {
  tasks: number;
  workflowBacked: number;
  commandOnly: number;
  aliasStrings: number;
  normalizedAliasKeys: number;
  categories: number;
}

export interface TaskCatalogPackage {
  directory: string;
  schemaVersion: string;
  datasetVersion: string;
  status: string;
  completenessClaim: boolean;
  labValidation: boolean;
  coverageBoundary: string;
  primaryBoundary: PackageBoundary;
  excludedSoftware: readonly string[];
}

export interface TaskCatalog {
  package: TaskCatalogPackage;
  tasks: readonly CatalogTask[];
  categories: readonly CatalogCategory[];
  counts: TaskCatalogCounts;
  tasksByNormalizedId: ReadonlyMap<string, readonly CatalogTask[]>;
  tasksByNormalizedTitle: ReadonlyMap<string, readonly CatalogTask[]>;
  tasksByNormalizedAlias: ReadonlyMap<string, readonly CatalogTask[]>;
}

export interface TaskDataError {
  code:
    | "MALFORMED_TASK"
    | "MALFORMED_WORKFLOW"
    | "MISSING_CATEGORY"
    | "MISSING_WORKFLOW"
    | "WORKFLOW_TASK_MISMATCH"
    | "COVERAGE_STATUS_MISMATCH"
    | "KNOWLEDGE_DATA_ERROR";
  message: string;
  taskId?: string;
}

export interface TaskSelectionContext {
  software?: string;
  platform?: string;
}

export interface ResolvedTask {
  state: "RESOLVED";
  normalizedInput: string;
  match: MatchStage;
  matchedAlias: string | null;
  task: CatalogTask;
}

export interface AmbiguousTask {
  state: "AMBIGUOUS";
  normalizedInput: string;
  match: MatchStage;
  candidates: readonly { taskId: string; title: string }[];
}

export interface UnsupportedTask {
  state: "UNSUPPORTED";
  normalizedInput: string;
  reason: "no_match" | "excluded_software";
  matchedExclusion: string | null;
}

export interface InvalidTaskInput {
  state: "INVALID_INPUT";
  reason: "empty" | "not_a_string";
}

export interface TaskDataFailure {
  ok: false;
  state: "DATA_ERROR";
  errors: readonly TaskDataError[];
}

export type TaskResolution =
  | ResolvedTask
  | AmbiguousTask
  | UnsupportedTask
  | InvalidTaskInput
  | TaskDataFailure;

export type CatalogBuildResult = { ok: true; catalog: TaskCatalog } | TaskDataFailure;
