import { PHASE_NAMES, type PhaseName } from "../knowledge/constants";
import { isNonEmptyString, isRecord, isStringArray } from "../knowledge/guards";
import type { CommandRecord, LoadedKnowledge, SyntaxElement } from "../knowledge/types";
import type { AcceptedInputValue, TaskInputValidation } from "../inputs/types";
import { normalizeTaskInput } from "../tasks";
import type { ResolvedBinding, ResolvedStep, WorkflowResolution } from "../workflows";
import type {
  BlockedRenderResult,
  RenderFailure,
  RenderState,
  RenderSubstitution,
  RenderedCommand,
  RenderedWorkflow,
  RenderResult,
} from "./types";

const CREDENTIAL_PLACEHOLDERS = new Set([
  "username",
  "password",
  "secret",
  "community",
  "token",
  "credential",
  "enable_secret",
  "private_key",
]);

const PLACEHOLDER_TOKEN = /\[<([^<>]+)>\]|<([^<>]+)>/g;

function flags(
  taskId: string | null,
  upstreamState: BlockedRenderResult["upstreamState"],
): Pick<BlockedRenderResult, "taskId" | "upstreamState" | "deviceExecutionAuthorized" | "procedureGenerated"> {
  return {
    taskId,
    upstreamState,
    deviceExecutionAuthorized: false,
    procedureGenerated: false,
  };
}

function blocked(
  state: Exclude<RenderState, "RENDERED">,
  taskId: string | null,
  upstreamState: BlockedRenderResult["upstreamState"],
  failures: readonly RenderFailure[] = [],
): BlockedRenderResult {
  return { state, ...flags(taskId, upstreamState), failures };
}

function failure(
  code: RenderFailure["code"],
  message: string,
  step?: { commandId: string; phase: PhaseName; stepIndex: number },
): RenderFailure {
  return step ? { code, message, commandId: step.commandId, phase: step.phase, stepIndex: step.stepIndex } : { code, message };
}

function placeholdersInOrder(syntax: string): string[] {
  return [...syntax.matchAll(/<([^<>]+)>/g)].map((match) => match[1]);
}

function optionalPlaceholders(syntax: string): Set<string> {
  return new Set([...syntax.matchAll(/\[<([^<>]+)>\]/g)].map((match) => match[1]));
}

function syntaxHasUnparsedBrackets(syntax: string): boolean {
  const withoutOptional = syntax.replace(/\[<([^<>]+)>\]/g, "");
  return withoutOptional.includes("[") || withoutOptional.includes("]");
}

function engineerText(value: AcceptedInputValue | undefined): string | null {
  if (!value) {
    return null;
  }
  if (typeof value.normalized === "number" && Number.isFinite(value.normalized)) {
    return String(value.normalized);
  }
  if (typeof value.normalized === "string" && value.normalized.length > 0) {
    return value.normalized;
  }
  return null;
}

function isCredentialName(name: string): boolean {
  return CREDENTIAL_PLACEHOLDERS.has(normalizeTaskInput(name));
}

function templateElements(command: CommandRecord, problems: RenderFailure[], step: ResolvedStep): SyntaxElement[] | null {
  if (typeof command.syntax !== "string" || command.syntax.length === 0) {
    problems.push(failure("MISSING_TEMPLATE", `Command ${command.command_id} has no syntax template.`, step));
    return null;
  }
  if (syntaxHasUnparsedBrackets(command.syntax) || !Array.isArray(command.syntax_elements)) {
    problems.push(failure("MALFORMED_TEMPLATE", `Command ${command.command_id} syntax is malformed.`, step));
    return null;
  }
  const elements: SyntaxElement[] = [];
  const names = new Set<string>();
  for (const element of command.syntax_elements) {
    if (!isRecord(element) || !isNonEmptyString(element.name) || typeof element.required !== "boolean") {
      problems.push(failure("MALFORMED_TEMPLATE", `Command ${command.command_id} has a malformed syntax element.`, step));
      return null;
    }
    if (names.has(element.name)) {
      problems.push(failure("MALFORMED_TEMPLATE", `Command ${command.command_id} declares ${element.name} more than once.`, step));
      return null;
    }
    names.add(element.name);
    elements.push({
      name: element.name,
      description: typeof element.description === "string" ? element.description : "",
      required: element.required,
      range: element.range === null || typeof element.range === "string" ? element.range : null,
    });
  }
  const placeholders = placeholdersInOrder(command.syntax);
  if (new Set(placeholders).size !== placeholders.length) {
    problems.push(failure("MALFORMED_TEMPLATE", `Command ${command.command_id} repeats a placeholder.`, step));
    return null;
  }
  if (placeholders.length !== elements.length || placeholders.some((name, index) => name !== elements[index].name)) {
    problems.push(
      failure(
        "MALFORMED_TEMPLATE",
        `Command ${command.command_id} placeholders do not match its syntax elements.`,
        step,
      ),
    );
    return null;
  }
  const optional = optionalPlaceholders(command.syntax);
  for (const element of elements) {
    if (optional.has(element.name) !== (element.required === false)) {
      problems.push(
        failure(
          "MALFORMED_TEMPLATE",
          `Command ${command.command_id} optional marker for ${element.name} disagrees with its required flag.`,
          step,
        ),
      );
      return null;
    }
  }
  return elements;
}

function renderTemplate(
  syntax: string,
  elements: readonly SyntaxElement[],
  bindings: readonly ResolvedBinding[],
  accepted: TaskInputValidation["accepted"],
  problems: RenderFailure[],
  step: ResolvedStep,
): { renderedCommand: string; substitutions: RenderSubstitution[] } | null {
  const byName = new Map<string, ResolvedBinding>();
  for (const binding of bindings) {
    if (binding.parameterName !== binding.syntaxElementName) {
      problems.push(failure("BINDING_ERROR", `Binding ${binding.parameterName} does not match its syntax element.`, step));
      return null;
    }
    if (byName.has(binding.syntaxElementName)) {
      problems.push(failure("BINDING_ERROR", `Placeholder ${binding.syntaxElementName} has more than one binding.`, step));
      return null;
    }
    byName.set(binding.syntaxElementName, binding);
  }
  for (const name of byName.keys()) {
    if (!elements.some((element) => element.name === name)) {
      problems.push(failure("BINDING_ERROR", `Binding ${name} has no placeholder on ${step.commandId}.`, step));
      return null;
    }
  }

  const substitutions: RenderSubstitution[] = [];
  const staticParts: string[] = [];
  let rendered = "";
  let cursor = 0;
  for (const match of syntax.matchAll(PLACEHOLDER_TOKEN)) {
    const token = match[0];
    const name = match[1] ?? match[2];
    const element = elements.find((item) => item.name === name);
    if (!element || match.index === undefined) {
      problems.push(failure("MALFORMED_TEMPLATE", `Command ${step.commandId} placeholder ${name} has no syntax element.`, step));
      return null;
    }
    const gap = syntax.slice(cursor, match.index);
    staticParts.push(gap);
    rendered += gap;
    cursor = match.index + token.length;
    if (isCredentialName(name)) {
      problems.push(failure("CREDENTIAL_PLACEHOLDER", `Command ${step.commandId} placeholder ${name} is credential material and is not substituted.`, step));
      return null;
    }
    const binding = byName.get(name);
    if (binding && (binding.engineerInputKey === null || isCredentialName(binding.engineerInputKey))) {
      const code = binding.engineerInputKey && isCredentialName(binding.engineerInputKey) ? "CREDENTIAL_PLACEHOLDER" : "BINDING_ERROR";
      problems.push(
        failure(
          code,
          binding.engineerInputKey
            ? `Engineer input ${binding.engineerInputKey} is credential material and is not substituted.`
            : `Placeholder ${name} on ${step.commandId} has no engineer input key.`,
          step,
        ),
      );
      return null;
    }
    const text = binding?.engineerInputKey ? engineerText(accepted[binding.engineerInputKey]) : null;
    if (!text) {
      if (element.required) {
        problems.push(
          failure("UNRESOLVED_PLACEHOLDER", `Required placeholder ${name} on ${step.commandId} has no validated engineer value.`, step),
        );
        return null;
      }
      if (rendered.endsWith(" ")) {
        rendered = rendered.slice(0, -1);
      }
      continue;
    }
    rendered += text;
    substitutions.push({
      placeholder: name,
      engineerInputKey: binding?.engineerInputKey ?? name,
      engineerValue: text,
      researchValue: binding?.researchValue ?? null,
    });
  }
  const tail = syntax.slice(cursor);
  staticParts.push(tail);
  rendered += tail;
  if (staticParts.some((part) => part.includes("<") || part.includes(">"))) {
    problems.push(failure("UNRESOLVED_PLACEHOLDER", `Command ${step.commandId} still contains an unresolved placeholder.`, step));
    return null;
  }
  return { renderedCommand: rendered, substitutions };
}

function renderStep(
  knowledge: LoadedKnowledge,
  step: ResolvedStep,
  workflowPlatformBoundary: string,
  taskId: string,
  workflowId: string,
  coverageStatus: string,
  accepted: TaskInputValidation["accepted"],
  problems: RenderFailure[],
): RenderedCommand | null {
  const command = knowledge.indexes.commandsById.get(step.commandId);
  if (!command) {
    problems.push(failure("MISSING_TEMPLATE", `Command ${step.commandId} does not resolve.`, step));
    return null;
  }
  const elements = templateElements(command, problems, step);
  if (!elements) {
    return null;
  }
  const rendered = renderTemplate(command.syntax, elements, step.bindings, accepted, problems, step);
  if (!rendered) {
    return null;
  }
  if (!isStringArray(command.cli_modes) || !(command.entry_context === null || typeof command.entry_context === "string")) {
    problems.push(failure("MALFORMED_TEMPLATE", `Command ${step.commandId} mode metadata is malformed.`, step));
    return null;
  }
  return {
    taskId,
    workflowId,
    phase: step.phase,
    stepIndex: step.stepIndex,
    commandId: step.commandId,
    template: command.syntax,
    renderedCommand: rendered.renderedCommand,
    substitutions: rendered.substitutions,
    cliModes: [...command.cli_modes],
    entryContext: command.entry_context,
    platformFamily: [...step.command.platformFamily],
    softwareFamily: step.command.softwareFamily,
    versionNotes: step.command.versionNotes,
    workflowPlatformBoundary,
    supportStatus: step.command.supportStatus,
    validationStatus: step.command.validationStatus,
    operationalRisk: step.command.operationalRisk,
    sourceIds: [...step.command.sourceIds],
    coverageStatus,
    engineerInputKeys: rendered.substitutions.map((item) => item.engineerInputKey),
  };
}

function stateFor(problems: readonly RenderFailure[]): Exclude<RenderState, "RENDERED" | "UPSTREAM_NOT_READY"> {
  if (problems.some((item) => item.code === "MISSING_TEMPLATE" || item.code === "MALFORMED_TEMPLATE" || item.code === "UPSTREAM_MISMATCH")) {
    return "DATA_ERROR";
  }
  if (problems.some((item) => item.code === "CREDENTIAL_PLACEHOLDER")) {
    return "UNSUPPORTED";
  }
  if (problems.some((item) => item.code === "BINDING_ERROR")) {
    return "BINDING_ERROR";
  }
  return "UNRESOLVED_PLACEHOLDER";
}

export function renderWorkflowCommands(
  knowledge: LoadedKnowledge,
  workflow: WorkflowResolution,
  validation: TaskInputValidation,
): RenderResult {
  if (workflow.state !== "RESOLVED") {
    return blocked("UPSTREAM_NOT_READY", workflow.taskId, workflow.state);
  }
  if (validation.state !== "READY" || validation.taskId !== workflow.taskId) {
    return blocked(
      validation.state === "READY" ? "DATA_ERROR" : "UPSTREAM_NOT_READY",
      workflow.taskId,
      validation.state,
      validation.state === "READY"
        ? [failure("UPSTREAM_MISMATCH", `Validated inputs do not belong to task ${workflow.taskId}.`)]
        : [],
    );
  }

  const problems: RenderFailure[] = [];
  const workflows: RenderedWorkflow[] = [];
  for (const item of workflow.workflows) {
    const commandsByPhase = new Map<PhaseName, RenderedCommand[]>(PHASE_NAMES.map((phase) => [phase, []]));
    for (const phase of item.phases) {
      const bucket = commandsByPhase.get(phase.phase);
      if (!bucket) {
        problems.push(failure("MALFORMED_TEMPLATE", `Workflow ${item.workflowId} has an unknown phase ${phase.phase}.`));
        continue;
      }
      for (const step of phase.steps) {
        const rendered = renderStep(
          knowledge,
          step,
          item.platformBoundary,
          workflow.taskId,
          item.workflowId,
          workflow.support.taskCoverageStatus,
          validation.accepted,
          problems,
        );
        if (rendered) {
          bucket.push(rendered);
        }
      }
    }
    workflows.push({
      workflowId: item.workflowId,
      platformBoundary: item.platformBoundary,
      phases: PHASE_NAMES.map((phase) => ({ phase, commands: commandsByPhase.get(phase) ?? [] })),
    });
  }
  if (problems.length > 0) {
    return blocked(stateFor(problems), workflow.taskId, validation.state, problems);
  }
  return {
    state: "RENDERED",
    ...flags(workflow.taskId, validation.state),
    taskId: workflow.taskId,
    activityEvidence: workflow.activityEvidence,
    workflows,
    support: workflow.support,
    failures: [],
  };
}
