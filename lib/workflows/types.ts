import type { PhaseName } from "../knowledge/constants";
import type { InputValidationState } from "../inputs";
import type { ActivityEvidence } from "../tasks";

export const WORKFLOW_RESOLUTION_STATES = [
  "RESOLVED",
  "WORKFLOW_NOT_ESTABLISHED",
  "UPSTREAM_NOT_READY",
  "UNSUPPORTED",
  "CONFLICT",
  "DATA_ERROR",
] as const;

export type WorkflowResolutionState = (typeof WORKFLOW_RESOLUTION_STATES)[number];

export interface ResolvedBinding {
  parameterName: string;
  syntaxElementName: string;
  engineerInputKey: string | null;
  researchValue: string | number;
}

export interface ResolvedSource {
  sourceId: string;
  title: string;
  platformBoundary: string;
  releaseBoundary: string;
  evidenceRef: string;
  reviewScope: string;
  section: string | null;
  evidenceLevel: string | null;
}

export interface ResolvedCommandReference {
  commandId: string;
  intent: string;
  platformFamily: readonly string[];
  softwareFamily: string;
  versionNotes: string;
  supportStatus: string;
  validationStatus: string;
  operationalRisk: {
    effect: string;
    level: string;
    caution: string | null;
  };
  sourceIds: readonly string[];
  sources: readonly ResolvedSource[];
  verificationCommandIds: readonly string[];
  troubleshootingCommandIds: readonly string[];
}

export interface ResolvedStep {
  phase: PhaseName;
  stepIndex: number;
  commandId: string;
  note: string | null;
  bindings: readonly ResolvedBinding[];
  command: ResolvedCommandReference;
}

export interface ResolvedPhase {
  phase: PhaseName;
  steps: readonly ResolvedStep[];
}

export interface ResolvedWorkflow {
  workflowId: string;
  taskId: string;
  title: string;
  platformBoundary: string;
  validationStatus: string;
  rollbackStrategy: string;
  sourceIds: readonly string[];
  sources: readonly ResolvedSource[];
  phases: readonly ResolvedPhase[];
}

export interface WorkflowSupport {
  packageStatus: string;
  completenessClaim: boolean;
  labValidation: boolean;
  primaryBoundary: {
    platform: string;
    software: string;
    release: string;
  };
  taskCoverageStatus: string;
  categoryCoverageStatus: string;
  coverageRowStatus: string | null;
  knownGaps: readonly string[];
  nextPartitionName: string;
}

export interface WorkflowDataError {
  code:
    | "UPSTREAM_MISMATCH"
    | "MISSING_WORKFLOW"
    | "WORKFLOW_TASK_MISMATCH"
    | "MALFORMED_PHASE"
    | "MALFORMED_STEP"
    | "MISSING_COMMAND"
    | "DUPLICATE_COMMAND"
    | "BROKEN_BINDING"
    | "MISSING_SOURCE"
    | "UNRESOLVED_VERIFICATION"
    | "COVERAGE_INCONSISTENCY"
    | "RELATIONSHIP_MISMATCH"
    | "MALFORMED_KNOWN_GAP";
  message: string;
  taskId?: string;
}

export interface WorkflowConflict {
  code: "PLATFORM_CONFLICT";
  message: string;
}

interface ResolutionFlags {
  taskId: string | null;
  upstreamState: InputValidationState | null;
  deviceExecutionAuthorized: false;
  commandsRendered: false;
  procedureGenerated: false;
}

export interface ResolvedWorkflowResult extends ResolutionFlags {
  state: "RESOLVED";
  taskId: string;
  activityEvidence: ActivityEvidence;
  workflows: readonly ResolvedWorkflow[];
  support: WorkflowSupport;
  errors: readonly [];
  conflicts: readonly [];
}

export interface BlockedWorkflowResult extends ResolutionFlags {
  state: Exclude<WorkflowResolutionState, "RESOLVED">;
  reason: "command_only" | "input_not_ready" | "platform_conflict" | "reference_integrity";
  errors: readonly WorkflowDataError[];
  conflicts: readonly WorkflowConflict[];
}

export type WorkflowResolution = ResolvedWorkflowResult | BlockedWorkflowResult;
