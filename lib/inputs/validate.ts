import { isRecord } from "../knowledge/guards";
import { normalizeTaskInput, type TaskSelectionContext } from "../tasks";
import type {
  AcceptedInputValue,
  InputDiscoveryResult,
  InputValidationState,
  TaskInputContract,
  TaskInputValidation,
} from "./types";

function emptyValidation(state: InputValidationState, taskId: string | null): TaskInputValidation {
  return {
    state,
    taskId,
    missing: [],
    invalid: [],
    conflicts: [],
    unknownInputs: [],
    accepted: {},
    unsupported: [],
    deviceExecutionAuthorized: false,
  };
}

function excludedValue(contract: TaskInputContract, context: TaskSelectionContext | undefined): string | null {
  if (!context) {
    return null;
  }
  const excluded = new Map(contract.excludedSoftware.map((entry) => [normalizeTaskInput(entry), entry]));
  for (const candidate of [context.software, context.platform]) {
    if (typeof candidate !== "string") {
      continue;
    }
    const match = excluded.get(normalizeTaskInput(candidate));
    if (match) {
      return match;
    }
  }
  return null;
}

function classifyValue(
  value: unknown,
): { kind: "missing" } | { kind: "invalid" } | { kind: "accepted"; value: AcceptedInputValue } {
  if (value === undefined || value === null) {
    return { kind: "missing" };
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length === 0) {
      return { kind: "missing" };
    }
    return { kind: "accepted", value: { original: value, normalized } };
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return { kind: "accepted", value: { original: value, normalized: value } };
  }
  return { kind: "invalid" };
}

export function validateTaskInputs(
  discovery: InputDiscoveryResult,
  values: unknown,
  context?: TaskSelectionContext,
): TaskInputValidation {
  if (!discovery.ok) {
    return emptyValidation(discovery.state, "taskId" in discovery ? discovery.taskId : null);
  }
  const contract = discovery.contract;
  if (!isRecord(values)) {
    const result = emptyValidation("INVALID_INPUT", contract.taskId);
    return {
      ...result,
      invalid: [{ inputKey: "", message: "Supplied task input must be an object keyed by input contract keys." }],
    };
  }

  const known = new Set(contract.inputs.map((input) => input.inputKey));
  const unknownInputs = Object.keys(values).filter((key) => !known.has(key)).sort();
  const missing: { inputKey: string; parameterName: string }[] = [];
  const invalid: { inputKey: string; message: string }[] = [];
  const accepted: Record<string, AcceptedInputValue> = {};
  const unsupported: { parameterName: string; constraint: string }[] = [];

  for (const input of contract.inputs) {
    if (input.validation.range === "declared_unevaluable") {
      unsupported.push({ parameterName: input.parameterName, constraint: "range" });
    }
    unsupported.push(
      { parameterName: input.parameterName, constraint: "format" },
      { parameterName: input.parameterName, constraint: "enumeration" },
      { parameterName: input.parameterName, constraint: "crossField" },
    );
    const classified = classifyValue(values[input.inputKey]);
    if (classified.kind === "missing") {
      if (input.requirement === "required") {
        missing.push({ inputKey: input.inputKey, parameterName: input.parameterName });
      }
      continue;
    }
    if (classified.kind === "invalid") {
      invalid.push({
        inputKey: input.inputKey,
        message: `${input.inputKey} must be a non-empty string or a finite number. No further Cisco format rule is established.`,
      });
      continue;
    }
    accepted[input.inputKey] = classified.value;
  }

  const exclusion = excludedValue(contract, context);
  let state: InputValidationState = "READY";
  if (exclusion || unsupported.some((item) => item.constraint === "range")) {
    state = "UNSUPPORTED_VALIDATION";
  } else if (invalid.length > 0) {
    state = "INVALID_INPUT";
  } else if (missing.length > 0) {
    state = "NEEDS_INPUT";
  }

  return {
    state,
    taskId: contract.taskId,
    missing,
    invalid,
    conflicts: [],
    unknownInputs,
    accepted,
    unsupported,
    deviceExecutionAuthorized: false,
  };
}
