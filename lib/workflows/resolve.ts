import { PHASE_NAMES, PHASE_RELATIONSHIP_TYPE, type PhaseName } from "../knowledge/constants";
import { isNonEmptyString, isRecord, isStringArray } from "../knowledge/guards";
import type { CommandRecord, LoadedKnowledge, SourceEvidence, SourceRecord, TaskWorkflow } from "../knowledge/types";
import type { InputDiscoveryResult, TaskInputContract, TaskInputValidation } from "../inputs";
import { normalizeTaskInput, type CatalogTask } from "../tasks";
import type {
  BlockedWorkflowResult,
  ResolvedBinding,
  ResolvedCommandReference,
  ResolvedPhase,
  ResolvedSource,
  ResolvedStep,
  ResolvedWorkflow,
  WorkflowConflict,
  WorkflowDataError,
  WorkflowResolution,
  WorkflowSupport,
} from "./types";

function flags(taskId: string | null, upstreamState: TaskInputValidation["state"] | null): Pick<
  BlockedWorkflowResult,
  "taskId" | "upstreamState" | "deviceExecutionAuthorized" | "commandsRendered" | "procedureGenerated"
> {
  return {
    taskId,
    upstreamState,
    deviceExecutionAuthorized: false,
    commandsRendered: false,
    procedureGenerated: false,
  };
}

function dataError(code: WorkflowDataError["code"], message: string, taskId: string): WorkflowDataError {
  return { code, message, taskId };
}

function blocked(
  state: BlockedWorkflowResult["state"],
  reason: BlockedWorkflowResult["reason"],
  taskId: string | null,
  upstreamState: TaskInputValidation["state"] | null,
  errors: readonly WorkflowDataError[] = [],
  conflicts: readonly WorkflowConflict[] = [],
): BlockedWorkflowResult {
  return { state, reason, ...flags(taskId, upstreamState), errors, conflicts };
}

function commandCounts(knowledge: LoadedKnowledge): Map<string, number> {
  const counts = new Map<string, number>();
  for (const command of knowledge.dataset.commands) {
    if (!isNonEmptyString(command.command_id)) {
      continue;
    }
    counts.set(command.command_id, (counts.get(command.command_id) ?? 0) + 1);
  }
  return counts;
}

function excludedMatch(value: string, excluded: readonly string[]): string | null {
  const normalized = normalizeTaskInput(value);
  return excluded.find((entry) => normalizeTaskInput(entry) === normalized) ?? null;
}

function sourceRecord(knowledge: LoadedKnowledge, sourceId: string): SourceRecord | undefined {
  return knowledge.indexes.sourcesById.get(sourceId);
}

function toSource(source: SourceRecord, evidence: SourceEvidence | null): ResolvedSource {
  return {
    sourceId: source.source_id,
    title: source.title,
    platformBoundary: source.platform_boundary,
    releaseBoundary: source.release_boundary,
    evidenceRef: source.evidence_ref,
    reviewScope: source.review_scope,
    section: evidence?.section ?? null,
    evidenceLevel: evidence?.evidence_level ?? null,
  };
}

function inputKeyFor(
  contract: TaskInputContract,
  commandId: string,
  phase: PhaseName,
  stepIndex: number,
  parameterName: string,
): string | null {
  for (const input of contract.inputs) {
    if (input.parameterName !== parameterName) {
      continue;
    }
    const matched = input.uses.some(
      (use) => use.commandId === commandId && use.phase === phase && use.stepIndex === stepIndex,
    );
    if (matched) {
      return input.inputKey;
    }
  }
  return null;
}

function relationshipUseSet(
  knowledge: LoadedKnowledge,
  workflowId: string,
  taskId: string,
  errors: WorkflowDataError[],
): Set<string> {
  const uses = new Set<string>();
  for (const edge of knowledge.dataset.relationships) {
    if (edge.workflow_id !== workflowId) {
      continue;
    }
    if (!isNonEmptyString(edge.type) || !isNonEmptyString(edge.to_id)) {
      errors.push(dataError("RELATIONSHIP_MISMATCH", `Workflow ${workflowId} has a malformed relationship edge.`, taskId));
      continue;
    }
    uses.add(`${edge.type}\0${edge.to_id}`);
  }
  return uses;
}

function resolveCommand(
  knowledge: LoadedKnowledge,
  counts: Map<string, number>,
  commandId: string,
  taskId: string,
  errors: WorkflowDataError[],
  conflicts: WorkflowConflict[],
): CommandRecord | null {
  const count = counts.get(commandId) ?? 0;
  if (count > 1) {
    errors.push(dataError("DUPLICATE_COMMAND", `Command ${commandId} has conflicting duplicate records.`, taskId));
    return null;
  }
  const command = knowledge.indexes.commandsById.get(commandId);
  if (!command || count !== 1 || !isNonEmptyString(command.software_family) || !isStringArray(command.platform_family) || !isRecord(command.operational_risk)) {
    errors.push(dataError("MISSING_COMMAND", `Command ${commandId} does not resolve.`, taskId));
    return null;
  }
  const excluded = knowledge.dataset.platform_version_metadata.excluded_software;
  const softwareHit = excludedMatch(command.software_family, excluded);
  if (softwareHit) {
    conflicts.push({
      code: "PLATFORM_CONFLICT",
      message: `Command ${commandId} software ${command.software_family} matches excluded software ${softwareHit}.`,
    });
  }
  for (const platform of command.platform_family) {
    const platformHit = excludedMatch(platform, excluded);
    if (platformHit) {
      conflicts.push({
        code: "PLATFORM_CONFLICT",
        message: `Command ${commandId} platform ${platform} matches excluded software ${platformHit}.`,
      });
    }
  }
  return command;
}

function commandSources(
  knowledge: LoadedKnowledge,
  command: CommandRecord,
  taskId: string,
  errors: WorkflowDataError[],
): ResolvedSource[] {
  const evidenceById = new Map<string, SourceEvidence>();
  if (!Array.isArray(command.source_evidence)) {
    errors.push(dataError("MISSING_SOURCE", `Command ${command.command_id} source evidence is malformed.`, taskId));
    return [];
  }
  for (const evidence of command.source_evidence) {
    if (!isRecord(evidence) || !isNonEmptyString(evidence.source_id)) {
      errors.push(dataError("MISSING_SOURCE", `Command ${command.command_id} has a malformed source evidence entry.`, taskId));
      continue;
    }
    evidenceById.set(evidence.source_id, evidence as SourceEvidence);
  }
  if (!isStringArray(command.source_ids)) {
    errors.push(dataError("MISSING_SOURCE", `Command ${command.command_id} source ids are malformed.`, taskId));
    return [];
  }
  const sources: ResolvedSource[] = [];
  for (const sourceId of command.source_ids) {
    const source = sourceRecord(knowledge, sourceId);
    const evidence = evidenceById.get(sourceId);
    if (!source || !evidence) {
      errors.push(dataError("MISSING_SOURCE", `Command ${command.command_id} source ${sourceId} does not resolve.`, taskId));
      continue;
    }
    sources.push(toSource(source, evidence));
  }
  for (const sourceId of evidenceById.keys()) {
    if (!command.source_ids.includes(sourceId)) {
      errors.push(dataError("MISSING_SOURCE", `Command ${command.command_id} evidence ${sourceId} is not a source id.`, taskId));
    }
  }
  return sources;
}

function referencedCommandIds(
  knowledge: LoadedKnowledge,
  counts: Map<string, number>,
  commandIds: readonly string[],
  field: string,
  ownerId: string,
  taskId: string,
  errors: WorkflowDataError[],
): string[] {
  if (!isStringArray(commandIds)) {
    errors.push(dataError("UNRESOLVED_VERIFICATION", `Command ${ownerId} ${field} is malformed.`, taskId));
    return [];
  }
  const resolved: string[] = [];
  for (const commandId of commandIds) {
    if ((counts.get(commandId) ?? 0) !== 1 || !knowledge.indexes.commandsById.has(commandId)) {
      errors.push(
        dataError("UNRESOLVED_VERIFICATION", `Command ${ownerId} ${field} references unresolved command ${commandId}.`, taskId),
      );
      continue;
    }
    resolved.push(commandId);
  }
  return resolved;
}

function bindingsFor(
  command: CommandRecord,
  stepValues: Record<string, unknown>,
  contract: TaskInputContract,
  phase: PhaseName,
  stepIndex: number,
  taskId: string,
  errors: WorkflowDataError[],
): ResolvedBinding[] {
  if (!Array.isArray(command.syntax_elements)) {
    errors.push(dataError("BROKEN_BINDING", `Command ${command.command_id} syntax elements are malformed.`, taskId));
    return [];
  }
  const elements = new Map<string, { name: string }>();
  for (const element of command.syntax_elements) {
    if (!isRecord(element) || !isNonEmptyString(element.name)) {
      errors.push(dataError("BROKEN_BINDING", `Command ${command.command_id} has a malformed syntax element.`, taskId));
      continue;
    }
    if (elements.has(element.name)) {
      errors.push(dataError("BROKEN_BINDING", `Command ${command.command_id} declares ${element.name} more than once.`, taskId));
      continue;
    }
    elements.set(element.name, { name: element.name });
    if (element.required === true && stepValues[element.name] === undefined) {
      errors.push(
        dataError(
          "BROKEN_BINDING",
          `Workflow step ${command.command_id} does not bind required parameter ${element.name}.`,
          taskId,
        ),
      );
    }
  }
  const bindings: ResolvedBinding[] = [];
  for (const [parameterName, researchValue] of Object.entries(stepValues)) {
    if (!elements.has(parameterName)) {
      errors.push(dataError("BROKEN_BINDING", `Workflow step binds unknown parameter ${parameterName} on ${command.command_id}.`, taskId));
      continue;
    }
    if (!(typeof researchValue === "string" || (typeof researchValue === "number" && Number.isFinite(researchValue)))) {
      errors.push(dataError("BROKEN_BINDING", `Workflow binding ${parameterName} on ${command.command_id} is not a string or finite number.`, taskId));
      continue;
    }
    const engineerInputKey = inputKeyFor(contract, command.command_id, phase, stepIndex, parameterName);
    if (!engineerInputKey) {
      errors.push(
        dataError(
          "BROKEN_BINDING",
          `Parameter ${parameterName} on ${command.command_id} has no engineer input key.`,
          taskId,
        ),
      );
      continue;
    }
    bindings.push({
      parameterName,
      syntaxElementName: parameterName,
      engineerInputKey,
      researchValue,
    });
  }
  return bindings;
}

function supportFor(knowledge: LoadedKnowledge, task: CatalogTask, errors: WorkflowDataError[]): WorkflowSupport | null {
  const category = knowledge.indexes.categoriesById.get(task.categoryId);
  const coverage = knowledge.indexes.coverageByCategoryId.get(task.categoryId) ?? null;
  if (!category) {
    errors.push(dataError("COVERAGE_INCONSISTENCY", `Task ${task.taskId} category ${task.categoryId} does not resolve.`, task.taskId));
    return null;
  }
  if (category.type === "feature_task_group") {
    if (!coverage || coverage.category_id !== task.categoryId || coverage.status !== category.coverage_status) {
      errors.push(
        dataError(
          "COVERAGE_INCONSISTENCY",
          `Coverage for ${task.categoryId} does not match the category support state.`,
          task.taskId,
        ),
      );
    }
  }
  if (!isStringArray(knowledge.coverage.unresolved) || !isNonEmptyString(knowledge.coverage.next_partition?.name)) {
    errors.push(dataError("MALFORMED_KNOWN_GAP", "Known-gap metadata is missing from the coverage document.", task.taskId));
    return null;
  }
  const boundary = knowledge.dataset.platform_version_metadata.primary_boundary;
  return {
    packageStatus: knowledge.dataset.metadata.status,
    completenessClaim: knowledge.dataset.metadata.completeness_claim,
    labValidation: knowledge.dataset.metadata.lab_validation,
    primaryBoundary: {
      platform: boundary.platform,
      software: boundary.software,
      release: boundary.release,
    },
    taskCoverageStatus: task.coverageStatus,
    categoryCoverageStatus: category.coverage_status,
    coverageRowStatus: coverage?.status ?? null,
    knownGaps: [...knowledge.coverage.unresolved],
    nextPartitionName: knowledge.coverage.next_partition.name,
  };
}

function resolveOneWorkflow(
  knowledge: LoadedKnowledge,
  task: CatalogTask,
  contract: TaskInputContract,
  workflowId: string,
  counts: Map<string, number>,
  errors: WorkflowDataError[],
  conflicts: WorkflowConflict[],
  seenUses: Set<string>,
): ResolvedWorkflow | null {
  const workflow = knowledge.indexes.workflowsById.get(workflowId);
  if (!workflow) {
    errors.push(dataError("MISSING_WORKFLOW", `Task ${task.taskId} references missing workflow ${workflowId}.`, task.taskId));
    return null;
  }
  if (workflow.task_id !== task.taskId) {
    errors.push(
      dataError("WORKFLOW_TASK_MISMATCH", `Workflow ${workflowId} belongs to ${workflow.task_id}, not ${task.taskId}.`, task.taskId),
    );
    return null;
  }
  if (!workflow.phases || !isNonEmptyString(workflow.platform_boundary) || !isNonEmptyString(workflow.rollback?.strategy)) {
    errors.push(dataError("MALFORMED_PHASE", `Workflow ${workflowId} is missing phases, platform boundary, or rollback.`, task.taskId));
    return null;
  }

  const stepUses = new Set<string>();
  const phases: ResolvedPhase[] = [];
  for (const phase of PHASE_NAMES) {
    const steps = workflow.phases[phase];
    if (!Array.isArray(steps)) {
      errors.push(dataError("MALFORMED_PHASE", `Workflow ${workflowId} phase ${phase} is not an ordered step list.`, task.taskId));
      phases.push({ phase, steps: [] });
      continue;
    }
    const resolvedSteps: ResolvedStep[] = [];
    steps.forEach((step, stepIndex) => {
      if (!isRecord(step) || !isNonEmptyString(step.command_id) || !isRecord(step.parameter_values) || !(step.note === null || typeof step.note === "string")) {
        errors.push(dataError("MALFORMED_STEP", `Workflow ${workflowId} ${phase}[${stepIndex}] is malformed.`, task.taskId));
        return;
      }
      stepUses.add(`${PHASE_RELATIONSHIP_TYPE[phase]}\0${step.command_id}`);
      const command = resolveCommand(knowledge, counts, step.command_id, task.taskId, errors, conflicts);
      if (!command) {
        return;
      }
      const commandMetadata = commandReference(knowledge, counts, command, task.taskId, errors);
      const bindings = bindingsFor(command, step.parameter_values, contract, phase, stepIndex, task.taskId, errors);
      for (const binding of bindings) {
        seenUses.add(`${phase}\0${stepIndex}\0${command.command_id}\0${binding.parameterName}`);
      }
      resolvedSteps.push({
        phase,
        stepIndex,
        commandId: command.command_id,
        note: step.note,
        bindings,
        command: commandMetadata,
      });
    });
    phases.push({ phase, steps: resolvedSteps });
  }

  const edgeUses = relationshipUseSet(knowledge, workflow.workflow_id, task.taskId, errors);
  if (stepUses.size !== edgeUses.size || [...stepUses].some((use) => !edgeUses.has(use))) {
    errors.push(
      dataError(
        "RELATIONSHIP_MISMATCH",
        `Workflow ${workflowId} relationship use-set does not match its ordered steps. Step order was not taken from relationship records.`,
        task.taskId,
      ),
    );
  }

  const sources = workflowSources(knowledge, workflow, task.taskId, errors);
  return {
    workflowId: workflow.workflow_id,
    taskId: workflow.task_id,
    title: workflow.title,
    platformBoundary: workflow.platform_boundary,
    validationStatus: workflow.validation_status,
    rollbackStrategy: workflow.rollback.strategy,
    sourceIds: isStringArray(workflow.source_ids) ? [...workflow.source_ids] : [],
    sources,
    phases,
  };
}

function commandReference(
  knowledge: LoadedKnowledge,
  counts: Map<string, number>,
  command: CommandRecord,
  taskId: string,
  errors: WorkflowDataError[],
): ResolvedCommandReference {
  return {
    commandId: command.command_id,
    intent: command.intent,
    platformFamily: [...command.platform_family],
    softwareFamily: command.software_family,
    versionNotes: command.version_notes,
    supportStatus: command.support_status,
    validationStatus: command.validation_status,
    operationalRisk: {
      effect: command.operational_risk.effect,
      level: command.operational_risk.level,
      caution: command.operational_risk.caution,
    },
    sourceIds: [...command.source_ids],
    sources: commandSources(knowledge, command, taskId, errors),
    verificationCommandIds: referencedCommandIds(
      knowledge,
      counts,
      command.verification_command_ids,
      "verification_command_ids",
      command.command_id,
      taskId,
      errors,
    ),
    troubleshootingCommandIds: referencedCommandIds(
      knowledge,
      counts,
      command.troubleshooting_command_ids,
      "troubleshooting_command_ids",
      command.command_id,
      taskId,
      errors,
    ),
  };
}

function workflowSources(
  knowledge: LoadedKnowledge,
  workflow: TaskWorkflow,
  taskId: string,
  errors: WorkflowDataError[],
): ResolvedSource[] {
  if (!isStringArray(workflow.source_ids)) {
    errors.push(dataError("MISSING_SOURCE", `Workflow ${workflow.workflow_id} source ids are malformed.`, taskId));
    return [];
  }
  const sources: ResolvedSource[] = [];
  for (const sourceId of workflow.source_ids) {
    const source = sourceRecord(knowledge, sourceId);
    if (!source) {
      errors.push(dataError("MISSING_SOURCE", `Workflow ${workflow.workflow_id} source ${sourceId} does not resolve.`, taskId));
      continue;
    }
    sources.push(toSource(source, null));
  }
  return sources;
}

export function verificationSteps(workflow: ResolvedWorkflow): readonly ResolvedStep[] {
  return workflow.phases.find((phase) => phase.phase === "verification")?.steps ?? [];
}

export function resolveWorkflow(
  knowledge: LoadedKnowledge,
  task: CatalogTask,
  discovery: InputDiscoveryResult,
  validation: TaskInputValidation,
): WorkflowResolution {
  if (task.workflowAvailability !== "present" || task.workflows.length === 0) {
    return blocked("WORKFLOW_NOT_ESTABLISHED", "command_only", task.taskId, validation.state);
  }
  if (validation.state !== "READY") {
    return blocked("UPSTREAM_NOT_READY", "input_not_ready", task.taskId, validation.state);
  }
  if (!discovery.ok || discovery.contract.taskId !== task.taskId || validation.taskId !== task.taskId) {
    return blocked(
      "DATA_ERROR",
      "reference_integrity",
      task.taskId,
      validation.state,
      [dataError("UPSTREAM_MISMATCH", `Input readiness for ${task.taskId} does not match the resolved task.`, task.taskId)],
    );
  }

  const errors: WorkflowDataError[] = [];
  const conflicts: WorkflowConflict[] = [];
  const counts = commandCounts(knowledge);
  const seenUses = new Set<string>();
  const workflows: ResolvedWorkflow[] = [];
  for (const workflowRef of task.workflows) {
    const resolved = resolveOneWorkflow(knowledge, task, discovery.contract, workflowRef.workflowId, counts, errors, conflicts, seenUses);
    if (resolved) {
      workflows.push(resolved);
    }
  }
  for (const input of discovery.contract.inputs) {
    for (const use of input.uses) {
      const key = `${use.phase}\0${use.stepIndex}\0${use.commandId}\0${input.parameterName}`;
      if (!seenUses.has(key)) {
        errors.push(
          dataError("BROKEN_BINDING", `Engineer input ${input.inputKey} does not match a workflow binding.`, task.taskId),
        );
      }
    }
  }
  const support = supportFor(knowledge, task, errors);
  if (errors.length > 0 || !support) {
    return blocked("DATA_ERROR", "reference_integrity", task.taskId, validation.state, errors);
  }
  if (conflicts.length > 0) {
    return blocked("CONFLICT", "platform_conflict", task.taskId, validation.state, [], conflicts);
  }

  return {
    state: "RESOLVED",
    ...flags(task.taskId, validation.state),
    taskId: task.taskId,
    activityEvidence: task.activityEvidence,
    workflows,
    support,
    errors: [],
    conflicts: [],
  };
}
