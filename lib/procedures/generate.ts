import { PHASE_NAMES, type PhaseName } from "../knowledge/constants";
import { isNonEmptyString, isRecord, isStringArray } from "../knowledge/guards";
import type { LoadedKnowledge } from "../knowledge/types";
import type { InputDiscoveryResult, TaskInputValidation } from "../inputs";
import type { RenderResult } from "../rendering";
import type { ActivityEvidence, CatalogTask } from "../tasks";
import type { ResolvedSource, ResolvedWorkflow, WorkflowResolution } from "../workflows/types";
import type {
  BlockedProcedureResult,
  GeneratedProcedure,
  ProcedureFailure,
  ProcedureInput,
  ProcedureResult,
  ProcedureSection,
  ProcedureState,
  ProcedureStep,
  ProcedureWarning,
  ProcedureWorkflow,
} from "./types";

const ACTIVITY_VALUES = new Set<ActivityEvidence>(["read_only", "configuration_changing", "not_established"]);

function blocked(
  state: Exclude<ProcedureState, "GENERATED">,
  reason: BlockedProcedureResult["reason"],
  taskId: string | null,
  upstreamState: string | null,
  failures: readonly ProcedureFailure[] = [],
): BlockedProcedureResult {
  return {
    state,
    reason,
    taskId,
    upstreamState,
    deviceExecutionAuthorized: false,
    procedureGenerated: false,
    failures,
  };
}

function failure(code: ProcedureFailure["code"], message: string): ProcedureFailure {
  return { code, message };
}

function acceptedText(value: TaskInputValidation["accepted"][string]): string | null {
  if (typeof value.normalized === "number" && Number.isFinite(value.normalized)) {
    return String(value.normalized);
  }
  if (typeof value.normalized === "string" && value.normalized.length > 0) {
    return value.normalized;
  }
  return null;
}

function sameSources(ids: readonly string[], sources: readonly ResolvedSource[]): boolean {
  return ids.length === sources.length && ids.every((id, index) => sources[index]?.sourceId === id);
}

function engineerInputs(discovery: InputDiscoveryResult, validation: TaskInputValidation, problems: ProcedureFailure[]): ProcedureInput[] {
  if (!discovery.ok || discovery.contract.taskId !== validation.taskId) {
    problems.push(failure("UPSTREAM_MISMATCH", "The input contract does not belong to the rendered task."));
    return [];
  }
  const inputs: ProcedureInput[] = [];
  for (const input of discovery.contract.inputs) {
    const accepted = validation.accepted[input.inputKey];
    if (!accepted) {
      if (input.requirement === "required") {
        problems.push(failure("MISSING_STEP", `Required engineer input ${input.inputKey} is not in the accepted values.`));
      }
      continue;
    }
    const text = acceptedText(accepted);
    if (!text) {
      problems.push(failure("UPSTREAM_MISMATCH", `Accepted value for ${input.inputKey} is not a validated string or number.`));
      continue;
    }
    inputs.push({
      inputKey: input.inputKey,
      acceptedValue: text,
      requirement: input.requirement,
      bindings: input.uses.map((use) => ({
        commandId: use.commandId,
        phase: use.phase,
        stepIndex: use.stepIndex,
        parameterName: input.parameterName,
      })),
    });
  }
  return inputs;
}

function assembleWorkflow(
  knowledge: LoadedKnowledge,
  workflow: ResolvedWorkflow,
  rendered: RenderResult & { state: "RENDERED" },
  problems: ProcedureFailure[],
): ProcedureWorkflow | null {
  const renderedWorkflow = rendered.workflows.find((item) => item.workflowId === workflow.workflowId);
  const record = knowledge.indexes.workflowsById.get(workflow.workflowId);
  if (!renderedWorkflow || !record) {
    problems.push(failure("MISSING_WORKFLOW", `Workflow ${workflow.workflowId} is not available for procedure assembly.`));
    return null;
  }
  if (!isNonEmptyString(workflow.platformBoundary) || workflow.platformBoundary !== renderedWorkflow.platformBoundary) {
    problems.push(failure("MISSING_PLATFORM", `Workflow ${workflow.workflowId} has no single platform boundary.`));
  }
  if (!isNonEmptyString(workflow.rollbackStrategy) || !isStringArray(record.rollback?.instructions)) {
    problems.push(failure("MISSING_ROLLBACK", `Workflow ${workflow.workflowId} rollback metadata is missing.`));
  }
  if (renderedWorkflow.phases.map((phase) => phase.phase).join() !== PHASE_NAMES.join()) {
    problems.push(failure("PHASE_ORDER", `Workflow ${workflow.workflowId} phase order does not match the workflow.`));
  }
  if (!isStringArray(record.prerequisites) || !isStringArray(record.expected_results) || !Array.isArray(record.decision_branches)) {
    problems.push(failure("MALFORMED_WORKFLOW", `Workflow ${workflow.workflowId} guidance metadata is malformed.`));
    return null;
  }
  const decisionBranches: { condition: string; action: string }[] = [];
  for (const branch of record.decision_branches) {
    if (!isRecord(branch) || !isNonEmptyString(branch.condition) || !isNonEmptyString(branch.action)) {
      problems.push(failure("MALFORMED_WORKFLOW", `Workflow ${workflow.workflowId} has a malformed decision branch.`));
      return null;
    }
    decisionBranches.push({ condition: branch.condition, action: branch.action });
  }

  const sections: ProcedureSection[] = [];
  const warnings: ProcedureWarning[] = [];
  for (const phase of PHASE_NAMES) {
    const resolvedPhase = workflow.phases.find((item) => item.phase === phase);
    const renderedPhase = renderedWorkflow.phases.find((item) => item.phase === phase);
    if (!resolvedPhase || !renderedPhase) {
      problems.push(failure("PHASE_ORDER", `Workflow ${workflow.workflowId} is missing the ${phase} section.`));
      continue;
    }
    if (resolvedPhase.steps.length !== renderedPhase.commands.length) {
      problems.push(
        failure(
          resolvedPhase.steps.length > renderedPhase.commands.length ? "MISSING_STEP" : "DUPLICATE_STEP",
          `Workflow ${workflow.workflowId} ${phase} step count does not match the rendered commands.`,
        ),
      );
    }
    const steps: ProcedureStep[] = [];
    const count = Math.min(resolvedPhase.steps.length, renderedPhase.commands.length);
    for (let index = 0; index < count; index += 1) {
      const resolvedStep = resolvedPhase.steps[index];
      const renderedStep = renderedPhase.commands[index];
      if (resolvedStep.commandId !== renderedStep.commandId || resolvedStep.stepIndex !== renderedStep.stepIndex || renderedStep.phase !== phase) {
        problems.push(failure("STEP_ORDER", `Workflow ${workflow.workflowId} ${phase}[${index}] does not match the rendered command.`));
        continue;
      }
      if (!isNonEmptyString(renderedStep.renderedCommand)) {
        problems.push(failure("MISSING_RENDERED_COMMAND", `Workflow ${workflow.workflowId} ${phase}[${index}] has no rendered command.`));
        continue;
      }
      if (!sameSources(renderedStep.sourceIds, resolvedStep.command.sources) || renderedStep.sourceIds.length === 0) {
        problems.push(failure("MISSING_SOURCE", `Command ${renderedStep.commandId} source provenance does not resolve.`));
        continue;
      }
      const command = knowledge.indexes.commandsById.get(renderedStep.commandId);
      if (!command || !isStringArray(command.expected_output)) {
        problems.push(failure("MALFORMED_WORKFLOW", `Command ${renderedStep.commandId} observation metadata is missing.`));
        continue;
      }
      const step: ProcedureStep = {
        stepIndex: resolvedStep.stepIndex,
        commandId: resolvedStep.commandId,
        template: renderedStep.template,
        renderedCommand: renderedStep.renderedCommand,
        intent: resolvedStep.command.intent,
        cliModes: [...renderedStep.cliModes],
        note: resolvedStep.note,
        normalPath: phase !== "troubleshooting",
        operationalRisk: renderedStep.operationalRisk,
        describedObservations: [...command.expected_output],
        observationValidation: "not_established",
        sources: resolvedStep.command.sources,
        engineerInputKeys: [...renderedStep.engineerInputKeys],
      };
      steps.push(step);
      if (isNonEmptyString(step.operationalRisk.caution)) {
        warnings.push({
          phase,
          stepIndex: step.stepIndex,
          commandId: step.commandId,
          effect: step.operationalRisk.effect,
          caution: step.operationalRisk.caution,
        });
      }
    }
    sections.push({ phase, steps });
  }
  if (!sameSources(workflow.sourceIds, workflow.sources)) {
    problems.push(failure("MISSING_SOURCE", `Workflow ${workflow.workflowId} source provenance does not resolve.`));
  }
  return {
    workflowId: workflow.workflowId,
    title: workflow.title,
    platformBoundary: workflow.platformBoundary,
    validationStatus: workflow.validationStatus,
    rollback: {
      strategy: workflow.rollbackStrategy,
      instructions: isStringArray(record.rollback?.instructions) ? [...record.rollback.instructions] : [],
    },
    prerequisites: [...record.prerequisites],
    describedResults: [...record.expected_results],
    resultValidation: "not_established",
    decisionBranches,
    sources: workflow.sources,
    sections,
    warnings,
  };
}

export function generateProcedure(
  knowledge: LoadedKnowledge,
  task: CatalogTask,
  discovery: InputDiscoveryResult,
  validation: TaskInputValidation,
  workflow: WorkflowResolution,
  rendered: RenderResult,
): ProcedureResult {
  if (workflow.state === "WORKFLOW_NOT_ESTABLISHED" || task.workflowAvailability !== "present") {
    return blocked("UNSUPPORTED", "procedure_not_established", task.taskId, rendered.state);
  }
  if (rendered.state !== "RENDERED" || workflow.state !== "RESOLVED" || validation.state !== "READY") {
    return blocked("UPSTREAM_NOT_RENDERED", "upstream", task.taskId, rendered.state);
  }
  if (rendered.taskId !== task.taskId || workflow.taskId !== task.taskId || validation.taskId !== task.taskId || !ACTIVITY_VALUES.has(rendered.activityEvidence) || rendered.activityEvidence !== task.activityEvidence) {
    return blocked("DATA_ERROR", "data_error", task.taskId, rendered.state, [
      failure("MALFORMED_ACTIVITY", `Procedure activity for ${task.taskId} is missing or does not match the rendered workflow.`),
    ]);
  }

  const problems: ProcedureFailure[] = [];
  const support = rendered.support;
  if (!support || !isNonEmptyString(support.primaryBoundary.platform) || !isNonEmptyString(support.primaryBoundary.software) || !isNonEmptyString(support.primaryBoundary.release) || !isStringArray(support.knownGaps) || !isNonEmptyString(support.nextPartitionName)) {
    problems.push(failure("MISSING_SUPPORT", "Procedure support, platform, or known-gap metadata is missing."));
  }
  const inputs = engineerInputs(discovery, validation, problems);
  const workflows: ProcedureWorkflow[] = [];
  if (workflow.workflows.length !== rendered.workflows.length) {
    problems.push(failure("MISSING_WORKFLOW", "The rendered workflow count does not match the resolved workflow."));
  }
  for (const item of workflow.workflows) {
    const assembled = assembleWorkflow(knowledge, item, rendered, problems);
    if (assembled) {
      workflows.push(assembled);
    }
  }
  if (problems.some((item) => item.code === "UPSTREAM_MISMATCH" || item.code === "MALFORMED_WORKFLOW" || item.code === "MALFORMED_ACTIVITY")) {
    return blocked("DATA_ERROR", "data_error", task.taskId, rendered.state, problems);
  }
  if (problems.length > 0) {
    return blocked("INCOMPLETE_PROCEDURE", "incomplete", task.taskId, rendered.state, problems);
  }

  const excluded = knowledge.dataset.platform_version_metadata.excluded_software;
  return {
    state: "GENERATED",
    taskId: task.taskId,
    taskTitle: task.title,
    activityEvidence: rendered.activityEvidence,
    configurationRequired: workflows.some((item) => item.sections.some((section) => section.phase === "configuration" && section.steps.length > 0)),
    deviceExecutionAuthorized: false,
    procedureGenerated: true,
    upstreamState: "RENDERED",
    failures: [],
    environment: {
      primaryBoundary: support.primaryBoundary,
      workflowPlatformBoundaries: workflows.map((item) => item.platformBoundary),
      excludedSoftware: isStringArray(excluded) ? [...excluded] : [],
    },
    engineerInputs: inputs,
    workflows,
    support: {
      packageStatus: support.packageStatus,
      completenessClaim: support.completenessClaim,
      labValidation: support.labValidation,
      taskCoverageStatus: support.taskCoverageStatus,
      categoryCoverageStatus: support.categoryCoverageStatus,
      coverageRowStatus: support.coverageRowStatus,
      validationStatus: workflows[0]?.validationStatus ?? task.validationStatus,
      knownGaps: [...support.knownGaps],
      nextPartitionName: support.nextPartitionName,
    },
  };
}
