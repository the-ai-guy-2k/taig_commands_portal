import type { PhaseName } from "../knowledge/constants";
import type { ActivityEvidence } from "../tasks";
import type { ResolvedSource } from "../workflows/types";

export const PROCEDURE_STATES = [
  "GENERATED",
  "UPSTREAM_NOT_RENDERED",
  "INCOMPLETE_PROCEDURE",
  "DATA_ERROR",
  "UNSUPPORTED",
] as const;

export type ProcedureState = (typeof PROCEDURE_STATES)[number];

export interface ProcedureInput {
  inputKey: string;
  acceptedValue: string;
  requirement: "required" | "optional";
  bindings: readonly {
    commandId: string;
    phase: PhaseName;
    stepIndex: number;
    parameterName: string;
  }[];
}

export interface ProcedureStep {
  stepIndex: number;
  commandId: string;
  template: string;
  renderedCommand: string;
  intent: string;
  cliModes: readonly string[];
  note: string | null;
  normalPath: boolean;
  operationalRisk: {
    effect: string;
    level: string;
    caution: string | null;
  };
  describedObservations: readonly string[];
  observationValidation: "not_established";
  sources: readonly ResolvedSource[];
  engineerInputKeys: readonly string[];
}

export interface ProcedureSection {
  phase: PhaseName;
  steps: readonly ProcedureStep[];
}

export interface ProcedureWarning {
  phase: PhaseName;
  stepIndex: number;
  commandId: string;
  effect: string;
  caution: string;
}

export interface ProcedureWorkflow {
  workflowId: string;
  title: string;
  platformBoundary: string;
  validationStatus: string;
  rollback: {
    strategy: string;
    instructions: readonly string[];
  };
  prerequisites: readonly string[];
  describedResults: readonly string[];
  resultValidation: "not_established";
  decisionBranches: readonly { condition: string; action: string }[];
  sources: readonly ResolvedSource[];
  sections: readonly ProcedureSection[];
  warnings: readonly ProcedureWarning[];
}

export interface GeneratedProcedure {
  state: "GENERATED";
  taskId: string;
  taskTitle: string;
  activityEvidence: ActivityEvidence;
  configurationRequired: boolean;
  deviceExecutionAuthorized: false;
  procedureGenerated: true;
  environment: {
    primaryBoundary: {
      platform: string;
      software: string;
      release: string;
    };
    workflowPlatformBoundaries: readonly string[];
    excludedSoftware: readonly string[];
  };
  engineerInputs: readonly ProcedureInput[];
  workflows: readonly ProcedureWorkflow[];
  support: {
    packageStatus: string;
    completenessClaim: boolean;
    labValidation: boolean;
    taskCoverageStatus: string;
    categoryCoverageStatus: string;
    coverageRowStatus: string | null;
    validationStatus: string | null;
    knownGaps: readonly string[];
    nextPartitionName: string;
  };
}

export interface ProcedureFailure {
  code:
    | "UPSTREAM_MISMATCH"
    | "MALFORMED_ACTIVITY"
    | "MALFORMED_WORKFLOW"
    | "MISSING_WORKFLOW"
    | "MISSING_STEP"
    | "DUPLICATE_STEP"
    | "PHASE_ORDER"
    | "STEP_ORDER"
    | "MISSING_RENDERED_COMMAND"
    | "MISSING_SOURCE"
    | "MISSING_PLATFORM"
    | "MISSING_ROLLBACK"
    | "MISSING_SUPPORT";
  message: string;
}

interface ProcedureFlags {
  taskId: string | null;
  upstreamState: string | null;
  deviceExecutionAuthorized: false;
  procedureGenerated: false;
}

export interface BlockedProcedureResult extends ProcedureFlags {
  state: Exclude<ProcedureState, "GENERATED">;
  reason: "procedure_not_established" | "upstream" | "incomplete" | "data_error";
  failures: readonly ProcedureFailure[];
}

export type ProcedureResult = (GeneratedProcedure & { failures: readonly []; upstreamState: "RENDERED" }) | BlockedProcedureResult;
