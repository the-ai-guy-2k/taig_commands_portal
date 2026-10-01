import type { PhaseName } from "../knowledge/constants";
import type { TaskSelectionContext } from "../tasks";

export const INPUT_VALIDATION_STATES = [
  "NEEDS_INPUT",
  "INVALID_INPUT",
  "CONFLICT",
  "READY",
  "UNSUPPORTED_VALIDATION",
  "DATA_ERROR",
] as const;

export type InputValidationState = (typeof INPUT_VALIDATION_STATES)[number];

export type ParameterRequirement = "required" | "optional";

export type RangeValidationSupport = "not_established" | "declared_unevaluable";

export interface TaskInputUse {
  commandId: string;
  phase: PhaseName;
  stepIndex: number;
}

export interface TaskInputRequirement {
  inputKey: string;
  parameterName: string;
  requirement: ParameterRequirement;
  description: string;
  range: string | null;
  exampleValue: string | number;
  uses: readonly TaskInputUse[];
  validation: {
    presence: "supported";
    valueShape: "string_or_finite_number";
    range: RangeValidationSupport;
    format: "not_established";
    enumeration: "not_established";
    crossField: "not_established";
  };
}

export interface TaskInputContract {
  taskId: string;
  workflowIds: readonly string[];
  workflowAvailability: "present";
  platformBoundaries: readonly string[];
  excludedSoftware: readonly string[];
  inputs: readonly TaskInputRequirement[];
  deviceExecutionAuthorized: false;
}

export interface InputDataError {
  code:
    | "MISSING_WORKFLOW"
    | "MISSING_COMMAND"
    | "BROKEN_BINDING"
    | "MALFORMED_PARAMETER"
    | "INCOMPATIBLE_PARAMETER"
    | "AMBIGUOUS_PARAMETER_KEY";
  message: string;
  taskId?: string;
}

export type InputDiscoveryResult =
  | { ok: true; contract: TaskInputContract }
  | {
      ok: false;
      state: "UNSUPPORTED_VALIDATION";
      reason: "input_contract_not_established";
      taskId: string;
    }
  | { ok: false; state: "DATA_ERROR"; errors: readonly InputDataError[] };

export interface AcceptedInputValue {
  original: string | number;
  normalized: string | number;
}

export interface TaskInputValidation {
  state: InputValidationState;
  taskId: string | null;
  missing: readonly { inputKey: string; parameterName: string }[];
  invalid: readonly { inputKey: string; message: string }[];
  conflicts: readonly { message: string }[];
  unknownInputs: readonly string[];
  accepted: Readonly<Record<string, AcceptedInputValue>>;
  unsupported: readonly { parameterName: string; constraint: string }[];
  deviceExecutionAuthorized: false;
}

export type { TaskSelectionContext };
