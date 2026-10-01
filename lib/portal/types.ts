import type { InputValidationState } from "../inputs/types";
import type { ActivityEvidence } from "../tasks/types";

export interface PortalError {
  code: string;
  message: string;
}

export interface FormFieldView {
  inputKey: string;
  parameterName: string;
  requirement: "required" | "optional";
  description: string;
  exampleValue: string;
  range: string | null;
}

export interface TaskFormView {
  taskId: string;
  state: "FORM" | "UNSUPPORTED_VALIDATION" | "DATA_ERROR";
  fields: readonly FormFieldView[];
  errors: readonly PortalError[];
  deviceExecutionAuthorized: false;
}

export interface ValidationView {
  state: InputValidationState;
  taskId: string | null;
  missing: readonly { inputKey: string; parameterName: string }[];
  invalid: readonly { inputKey: string; message: string }[];
  conflicts: readonly { message: string }[];
  unknownInputs: readonly string[];
  deviceExecutionAuthorized: false;
}

export interface ProcedureCommandView {
  stepIndex: number;
  commandId: string;
  renderedCommand: string;
  intent: string;
  normalPath: boolean;
  caution: string | null;
  effect: string;
  level: string;
  sourceIds: readonly string[];
}

export interface ProcedureSectionView {
  phase: string;
  steps: readonly ProcedureCommandView[];
}

export interface ProcedureSourceView {
  sourceId: string;
  title: string;
  platformBoundary: string;
  releaseBoundary: string;
}

export interface ProcedurePresentation {
  taskId: string;
  taskTitle: string;
  activityEvidence: ActivityEvidence;
  configurationRequired: boolean;
  deviceExecutionAuthorized: false;
  procedureGenerated: true;
  workflowId: string;
  workflowTitle: string;
  platformBoundary: string;
  validationStatus: string;
  rollback: {
    strategy: string;
    instructions: readonly string[];
  };
  engineerInputs: readonly {
    inputKey: string;
    acceptedValue: string;
    requirement: string;
  }[];
  sections: readonly ProcedureSectionView[];
  warnings: readonly {
    phase: string;
    commandId: string;
    effect: string;
    caution: string;
  }[];
  sources: readonly ProcedureSourceView[];
  environment: {
    primaryBoundary: { platform: string; software: string; release: string };
    workflowPlatformBoundaries: readonly string[];
    excludedSoftware: readonly string[];
  };
  support: {
    packageStatus: string;
    completenessClaim: boolean;
    labValidation: boolean;
    taskCoverageStatus: string;
    validationStatus: string | null;
    knownGaps: readonly string[];
  };
}

export type ProcedureRun =
  | { kind: "VALIDATION"; validation: ValidationView; procedure: null }
  | { kind: "GENERATED"; validation: ValidationView; procedure: ProcedurePresentation }
  | {
      kind: "BLOCKED";
      state: string;
      reason: string;
      messages: readonly string[];
      procedure: null;
      deviceExecutionAuthorized: false;
    }
  | { kind: "DATA_ERROR"; errors: readonly PortalError[]; procedure: null; deviceExecutionAuthorized: false };

export type FormStatus =
  | "FORM_READY"
  | "GENERATING"
  | "NEEDS_INPUT"
  | "INVALID_INPUT"
  | "CONFLICT"
  | "UNSUPPORTED_VALIDATION"
  | "READY"
  | "GENERATED"
  | "UPSTREAM_ERROR"
  | "DATA_ERROR";

export interface FormSession {
  taskId: string | null;
  generationId: number;
  values: Readonly<Record<string, string>>;
  status: FormStatus;
  result: ProcedureRun | null;
}
