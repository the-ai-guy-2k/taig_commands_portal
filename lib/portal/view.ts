import type { GeneratedProcedure } from "../procedures/types";
import type { ResolvedSource } from "../workflows/types";
import type { ProcedurePresentation, ProcedureSourceView } from "./types";

export function toProcedurePresentation(procedure: GeneratedProcedure): ProcedurePresentation {
  const workflow = procedure.workflows[0];
  const sources = new Map<string, ProcedureSourceView>();
  for (const source of workflow?.sources ?? []) {
    rememberSource(sources, source);
  }
  for (const section of workflow?.sections ?? []) {
    for (const step of section.steps) {
      for (const source of step.sources) {
        rememberSource(sources, source);
      }
    }
  }

  return {
    taskId: procedure.taskId,
    taskTitle: procedure.taskTitle,
    activityEvidence: procedure.activityEvidence,
    configurationRequired: procedure.configurationRequired,
    deviceExecutionAuthorized: false,
    procedureGenerated: true,
    workflowId: workflow?.workflowId ?? "",
    workflowTitle: workflow?.title ?? "",
    platformBoundary: workflow?.platformBoundary ?? "",
    validationStatus: workflow?.validationStatus ?? "",
    rollback: {
      strategy: workflow?.rollback.strategy ?? "",
      instructions: [...(workflow?.rollback.instructions ?? [])],
    },
    engineerInputs: procedure.engineerInputs.map((input) => ({
      inputKey: input.inputKey,
      acceptedValue: input.acceptedValue,
      requirement: input.requirement,
    })),
    sections: (workflow?.sections ?? []).map((section) => ({
      phase: section.phase,
      steps: section.steps.map((step) => ({
        stepIndex: step.stepIndex,
        commandId: step.commandId,
        renderedCommand: step.renderedCommand,
        intent: step.intent,
        normalPath: step.normalPath,
        caution: step.operationalRisk.caution,
        effect: step.operationalRisk.effect,
        level: step.operationalRisk.level,
        sourceIds: step.sources.map((source) => source.sourceId),
      })),
    })),
    warnings: (workflow?.warnings ?? []).map((warning) => ({
      phase: warning.phase,
      commandId: warning.commandId,
      effect: warning.effect,
      caution: warning.caution,
    })),
    sources: [...sources.values()],
    environment: {
      primaryBoundary: { ...procedure.environment.primaryBoundary },
      workflowPlatformBoundaries: [...procedure.environment.workflowPlatformBoundaries],
      excludedSoftware: [...procedure.environment.excludedSoftware],
    },
    support: {
      packageStatus: procedure.support.packageStatus,
      completenessClaim: procedure.support.completenessClaim,
      labValidation: procedure.support.labValidation,
      taskCoverageStatus: procedure.support.taskCoverageStatus,
      validationStatus: procedure.support.validationStatus,
      knownGaps: [...procedure.support.knownGaps],
    },
  };
}

function rememberSource(sources: Map<string, ProcedureSourceView>, source: ResolvedSource) {
  if (sources.has(source.sourceId)) {
    return;
  }
  sources.set(source.sourceId, {
    sourceId: source.sourceId,
    title: source.title,
    platformBoundary: source.platformBoundary,
    releaseBoundary: source.releaseBoundary,
  });
}
