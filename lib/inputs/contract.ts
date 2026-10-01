import { PHASE_NAMES, type PhaseName } from "../knowledge/constants";
import { isNonEmptyString, isRecord } from "../knowledge/guards";
import type { LoadedKnowledge } from "../knowledge/types";
import type { CatalogTask } from "../tasks";
import type {
  InputDataError,
  InputDiscoveryResult,
  RangeValidationSupport,
  TaskInputRequirement,
  TaskInputUse,
} from "./types";

interface Occurrence {
  name: string;
  description: string;
  required: boolean;
  range: string | null;
  example: string | number;
  use: TaskInputUse;
}

interface InputGroup {
  name: string;
  description: string;
  required: boolean;
  range: string | null;
  example: string | number;
  uses: TaskInputUse[];
}

function error(code: InputDataError["code"], message: string, taskId: string): InputDataError {
  return { code, message, taskId };
}

function isExampleValue(value: unknown): value is string | number {
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value));
}

function groupIdentity(group: Pick<InputGroup, "name" | "description" | "range" | "example">): string {
  return JSON.stringify([group.name, group.description, group.range, group.example]);
}

export function discoverTaskInputContract(
  knowledge: LoadedKnowledge,
  task: CatalogTask,
): InputDiscoveryResult {
  if (task.workflowAvailability !== "present" || task.workflows.length === 0) {
    return { ok: false, state: "UNSUPPORTED_VALIDATION", reason: "input_contract_not_established", taskId: task.taskId };
  }

  const errors: InputDataError[] = [];
  const groups: InputGroup[] = [];

  for (const workflowRef of task.workflows) {
    const workflow = knowledge.indexes.workflowsById.get(workflowRef.workflowId);
    if (!workflow || !isRecord(workflow.phases)) {
      errors.push(error("MISSING_WORKFLOW", `Workflow ${workflowRef.workflowId} is not available for input discovery.`, task.taskId));
      continue;
    }

    for (const phase of PHASE_NAMES) {
      const steps = workflow.phases[phase];
      if (!Array.isArray(steps)) {
        errors.push(error("MALFORMED_PARAMETER", `Workflow ${workflow.workflow_id} phase ${phase} is not an ordered step list.`, task.taskId));
        continue;
      }
      steps.forEach((step, stepIndex) => {
        if (!isRecord(step) || !isNonEmptyString(step.command_id) || !isRecord(step.parameter_values)) {
          errors.push(error("BROKEN_BINDING", `Workflow ${workflow.workflow_id} ${phase}[${stepIndex}] binding is malformed.`, task.taskId));
          return;
        }
        const command = knowledge.indexes.commandsById.get(step.command_id);
        if (!command || !Array.isArray(command.syntax_elements)) {
          errors.push(error("MISSING_COMMAND", `Workflow ${workflow.workflow_id} references missing command ${step.command_id}.`, task.taskId));
          return;
        }
        const elements = new Map<string, { description: string; required: boolean; range: string | null }>();
        for (const element of command.syntax_elements) {
          if (!isRecord(element) || !isNonEmptyString(element.name) || typeof element.description !== "string" || typeof element.required !== "boolean" || !(element.range === null || typeof element.range === "string")) {
            errors.push(error("MALFORMED_PARAMETER", `Command ${command.command_id} has a malformed syntax element.`, task.taskId));
            return;
          }
          if (elements.has(element.name)) {
            errors.push(error("INCOMPATIBLE_PARAMETER", `Command ${command.command_id} declares ${element.name} more than once.`, task.taskId));
            return;
          }
          elements.set(element.name, {
            description: element.description,
            required: element.required,
            range: element.range,
          });
        }
        for (const name of Object.keys(step.parameter_values)) {
          if (!elements.has(name)) {
            errors.push(error("BROKEN_BINDING", `Workflow ${workflow.workflow_id} binds unknown parameter ${name} on ${command.command_id}.`, task.taskId));
          }
        }
        for (const [name, element] of elements) {
          const bound = step.parameter_values[name];
          if (element.required && bound === undefined) {
            errors.push(error("BROKEN_BINDING", `Workflow ${workflow.workflow_id} does not bind required parameter ${name} on ${command.command_id}.`, task.taskId));
            continue;
          }
          if (bound === undefined) {
            continue;
          }
          if (!isExampleValue(bound)) {
            errors.push(error("MALFORMED_PARAMETER", `Workflow binding ${name} on ${command.command_id} is not a string or finite number.`, task.taskId));
            continue;
          }
          const use: TaskInputUse = { commandId: command.command_id, phase: phase as PhaseName, stepIndex };
          const candidate: Occurrence = {
            name,
            description: element.description,
            required: element.required,
            range: element.range,
            example: bound,
            use,
          };
          const existing = groups.find((group) => groupIdentity(group) === groupIdentity(candidate));
          if (existing) {
            existing.required = existing.required || candidate.required;
            existing.uses.push(use);
          } else {
            groups.push({
              name: candidate.name,
              description: candidate.description,
              required: candidate.required,
              range: candidate.range,
              example: candidate.example,
              uses: [use],
            });
          }
        }
      });
    }
  }

  const incompatible = new Map<string, Set<string>>();
  for (const group of groups) {
    const key = JSON.stringify([group.name, group.description]);
    const ranges = incompatible.get(key) ?? new Set<string>();
    ranges.add(JSON.stringify(group.range));
    incompatible.set(key, ranges);
  }
  for (const [key, ranges] of incompatible) {
    if (ranges.size > 1) {
      const [name] = JSON.parse(key) as [string, string];
      errors.push(error("INCOMPATIBLE_PARAMETER", `Parameter ${name} has conflicting range metadata in ${task.taskId}.`, task.taskId));
    }
  }
  if (errors.length > 0) {
    return { ok: false, state: "DATA_ERROR", errors };
  }

  const nameCounts = new Map<string, number>();
  for (const group of groups) {
    nameCounts.set(group.name, (nameCounts.get(group.name) ?? 0) + 1);
  }
  const inputs: TaskInputRequirement[] = [];
  for (const group of groups) {
    const sharedName = (nameCounts.get(group.name) ?? 0) > 1;
    let inputKey = group.name;
    if (sharedName) {
      if (group.uses.length !== 1) {
        errors.push(error("AMBIGUOUS_PARAMETER_KEY", `Parameter ${group.name} needs more than one engineer value and cannot share one field.`, task.taskId));
        continue;
      }
      inputKey = `${group.uses[0].commandId}.${group.name}`;
    }
    const rangeSupport: RangeValidationSupport = group.range === null ? "not_established" : "declared_unevaluable";
    inputs.push({
      inputKey,
      parameterName: group.name,
      requirement: group.required ? "required" : "optional",
      description: group.description,
      range: group.range,
      exampleValue: group.example,
      uses: group.uses,
      validation: {
        presence: "supported",
        valueShape: "string_or_finite_number",
        range: rangeSupport,
        format: "not_established",
        enumeration: "not_established",
        crossField: "not_established",
      },
    });
  }
  if (errors.length > 0) {
    return { ok: false, state: "DATA_ERROR", errors };
  }

  return {
    ok: true,
    contract: {
      taskId: task.taskId,
      workflowIds: task.workflows.map((workflow) => workflow.workflowId),
      workflowAvailability: "present",
      platformBoundaries: task.workflows.map((workflow) => workflow.platformBoundary),
      excludedSoftware: [...knowledge.dataset.platform_version_metadata.excluded_software],
      inputs,
      deviceExecutionAuthorized: false,
    },
  };
}
