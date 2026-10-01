import { discoverTaskInputContract, validateTaskInputs } from "../inputs";
import { isRecord } from "../knowledge/guards";
import { loadKnowledgePackage, type LoadKnowledgeOptions } from "../knowledge";
import { generateProcedure } from "../procedures";
import { renderWorkflowCommands } from "../rendering";
import { buildTaskCatalog, getTaskById } from "../tasks";
import { resolveWorkflow } from "../workflows";
import type { ProcedureRun, ValidationView } from "./types";
import { toProcedurePresentation } from "./view";

export async function runTaskProcedure(
  taskId: string,
  values: unknown,
  options: LoadKnowledgeOptions = {},
): Promise<ProcedureRun> {
  const supplied = readValues(values);
  if (!supplied) {
    return {
      kind: "VALIDATION",
      procedure: null,
      validation: {
        state: "INVALID_INPUT",
        taskId: typeof taskId === "string" ? taskId : null,
        missing: [],
        invalid: [{ inputKey: "", message: "Task inputs must be an object of strings." }],
        conflicts: [],
        unknownInputs: [],
        deviceExecutionAuthorized: false,
      },
    };
  }

  const loaded = await loadKnowledgePackage(options);
  if (!loaded.ok) {
    return {
      kind: "DATA_ERROR",
      procedure: null,
      deviceExecutionAuthorized: false,
      errors: loaded.errors.map((error) => ({ code: error.code, message: error.message })),
    };
  }
  const catalog = buildTaskCatalog(loaded.knowledge);
  if (!catalog.ok) {
    return {
      kind: "DATA_ERROR",
      procedure: null,
      deviceExecutionAuthorized: false,
      errors: catalog.errors.map((error) => ({ code: error.code, message: error.message })),
    };
  }

  const resolved = getTaskById(catalog.catalog, taskId);
  if (resolved.state !== "RESOLVED") {
    return {
      kind: "BLOCKED",
      state: resolved.state,
      reason: "reason" in resolved ? resolved.reason : resolved.state,
      messages: ["The requested task is not an accepted catalog identity."],
      procedure: null,
      deviceExecutionAuthorized: false,
    };
  }

  const discovery = discoverTaskInputContract(loaded.knowledge, resolved.task);
  const validation = validateTaskInputs(discovery, supplied);
  const validationView = toValidationView(validation);
  if (validation.state !== "READY") {
    return { kind: "VALIDATION", validation: validationView, procedure: null };
  }

  const workflow = resolveWorkflow(loaded.knowledge, resolved.task, discovery, validation);
  const rendered = renderWorkflowCommands(loaded.knowledge, workflow, validation);
  const procedure = generateProcedure(loaded.knowledge, resolved.task, discovery, validation, workflow, rendered);
  if (procedure.state !== "GENERATED") {
    return {
      kind: "BLOCKED",
      state: procedure.state,
      reason: procedure.reason,
      messages:
        procedure.failures.length > 0
          ? procedure.failures.map((failure) => failure.message)
          : [`${procedure.state}: ${procedure.reason}`],
      procedure: null,
      deviceExecutionAuthorized: false,
    };
  }

  return { kind: "GENERATED", validation: validationView, procedure: toProcedurePresentation(procedure) };
}

function toValidationView(validation: {
  state: ValidationView["state"];
  taskId: string | null;
  missing: ValidationView["missing"];
  invalid: ValidationView["invalid"];
  conflicts: ValidationView["conflicts"];
  unknownInputs: readonly string[];
}): ValidationView {
  return {
    state: validation.state,
    taskId: validation.taskId,
    missing: validation.missing.map((item) => ({ inputKey: item.inputKey, parameterName: item.parameterName })),
    invalid: validation.invalid.map((item) => ({ inputKey: item.inputKey, message: item.message })),
    conflicts: validation.conflicts.map((item) => ({ message: item.message })),
    unknownInputs: [...validation.unknownInputs],
    deviceExecutionAuthorized: false,
  };
}

function readValues(values: unknown): Record<string, string> | null {
  if (!isRecord(values)) {
    return null;
  }
  const supplied: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== "string") {
      return null;
    }
    supplied[key] = value;
  }
  return supplied;
}
