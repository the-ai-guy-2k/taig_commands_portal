import type { DiscoveryTask } from "../discovery/types";
import type { TaskResolution } from "../tasks/types";
import type { ProcedureRun, ValidationView } from "../portal/types";
import type { CoverageFact, EngineerNotice } from "./types";

export function coverageLabel(status: string): string {
  if (status === "seed_partial") {
    return "Partial seed (seed_partial)";
  }
  if (status === "command_only") {
    return "Command-only (command_only)";
  }
  return status;
}

export function packageCoverageFacts(input: {
  status: string;
  completenessClaim: boolean;
  labValidation: boolean;
  validationStatus: string;
  platform: string;
  software: string;
  release: string;
  excludedSoftware: readonly string[];
}): CoverageFact[] {
  return [
    {
      label: "Status",
      value: input.status,
      meaning: "The knowledge package is a partial research set. PARTIAL describes that limit. It does not mean the application failed to load.",
    },
    {
      label: "Completeness claim",
      value: String(input.completenessClaim),
      meaning: "False means the package does not claim to be a complete Cisco reference. That is a coverage limit, not a load failure.",
    },
    {
      label: "Lab validation",
      value: String(input.labValidation),
      meaning: "False means this package has not been lab validated. The portal can still load and present the research that is present.",
    },
    {
      label: "Validation status",
      value: input.validationStatus,
      meaning: "Documentation was reviewed. The package was not tested on a device.",
    },
    {
      label: "Primary research boundary",
      value: `${input.platform} / ${input.software} ${input.release}`,
      meaning: "Workflow research is bounded to this platform and release unless a source record says otherwise.",
    },
    {
      label: "Excluded software",
      value: input.excludedSoftware.join(", "),
      meaning: "These software families are outside the package. Exclusion is not the same as a missing search result.",
    },
  ];
}

export function presentTaskSupport(task: DiscoveryTask): EngineerNotice {
  if (task.workflowAvailability === "absent") {
    return {
      backendState: "WORKFLOW_NOT_ESTABLISHED",
      category: "attention",
      headline: "This task is known. Workflow not established.",
      explanation:
        "The catalog includes this task, and command knowledge may exist. No workflow has been established, so a governed procedure cannot be generated. Procedure not available. Activity state may be not_established. Tagged commands are not shown as a substitute procedure.",
      nextAction: "Select a workflow-backed task when a procedure is required. This command-only task stays in the catalog.",
      procedureVisible: false,
      technicalDetail: `workflow absent; coverage ${task.coverageStatus}; activity ${task.activityEvidence}`,
    };
  }
  const validation = task.validationStatus ?? "not established";
  return {
    backendState: "WORKFLOW_BACKED",
    category: "information",
    headline: "Workflow-backed task. Coverage is partial.",
    explanation: `Coverage ${task.coverageStatus}. Validation ${validation}. A workflow exists, so the required inputs can be entered. seed_partial does not mean complete, production-ready, or device-tested. Ready does not authorize device execution.`,
    nextAction: "Enter the required inputs, then generate the procedure.",
    procedureVisible: false,
    technicalDetail: `workflow present; coverage ${task.coverageStatus}; validation ${validation}`,
  };
}

export function presentValidation(validation: ValidationView): EngineerNotice {
  const task = validation.taskId ?? "the selected task";
  if (validation.state === "NEEDS_INPUT") {
    const missing = validation.missing.map((item) => item.inputKey).join(", ");
    return {
      backendState: "NEEDS_INPUT",
      category: "attention",
      headline: "Required information is missing",
      explanation: `Procedure generation is blocked for ${task} until these required inputs are supplied: ${missing}.`,
      nextAction: "Enter the missing values and generate again.",
      procedureVisible: false,
      technicalDetail: "NEEDS_INPUT",
    };
  }
  if (validation.state === "INVALID_INPUT") {
    const details = validation.invalid.map((item) => item.message).join(" ");
    return {
      backendState: "INVALID_INPUT",
      category: "attention",
      headline: "A supplied value violates an established rule",
      explanation: details || "The backend reported a structural validation failure.",
      nextAction: "Correct the listed field using only the rule the backend stated, then generate again.",
      procedureVisible: false,
      technicalDetail: "INVALID_INPUT",
    };
  }
  if (validation.state === "CONFLICT") {
    return {
      backendState: "CONFLICT",
      category: "attention",
      headline: "The supplied inputs conflict",
      explanation: validation.conflicts.map((item) => item.message).join(" ") || "The backend reported a conflict.",
      nextAction: "Resolve the listed conflict before generating a procedure.",
      procedureVisible: false,
      technicalDetail: "CONFLICT",
    };
  }
  if (validation.state === "UNSUPPORTED_VALIDATION") {
    const constraints = uniqueConstraints(validation.unsupported);
    const constraintText =
      constraints.length > 0
        ? ` Declared constraints that cannot be evaluated: ${constraints.join(", ")}.`
        : " The input contract or a declared constraint cannot be evaluated.";
    return {
      backendState: "UNSUPPORTED_VALIDATION",
      category: "attention",
      headline: "Validation is not established",
      explanation: `The portal does not have enough authoritative rule data to validate this value. The supplied value is not marked invalid.${constraintText}`,
      nextAction: "Do not treat this as a Cisco rule failure. A procedure is not generated from an unevaluable constraint.",
      procedureVisible: false,
      technicalDetail: "UNSUPPORTED_VALIDATION",
    };
  }
  if (validation.state === "DATA_ERROR") {
    return dataErrorNotice("The input path could not be validated from the loaded knowledge.");
  }
  return {
    backendState: "READY",
    category: "information",
    headline: "Required inputs are present",
    explanation:
      "READY means the governed procedure can be generated. It does not mean the result is safe for a live Cisco device, and it does not mean the package is complete or device tested.",
    nextAction: "Generate the procedure. Device execution stays unauthorized.",
    procedureVisible: false,
    technicalDetail: "READY",
  };
}

export function fieldIssue(
  validation: ValidationView | null,
  inputKey: string,
): { message: string } | null {
  if (!validation || validation.state === "UNSUPPORTED_VALIDATION") {
    return null;
  }
  const invalid = validation.invalid.find((item) => item.inputKey === inputKey);
  if (validation.state === "INVALID_INPUT" && invalid) {
    return {
      message: `INVALID_INPUT. This value violates an established rule. ${invalid.message}`,
    };
  }
  if (validation.state === "NEEDS_INPUT" && validation.missing.some((item) => item.inputKey === inputKey)) {
    return {
      message: "NEEDS_INPUT. This required value is missing. Procedure generation stays blocked until it is supplied.",
    };
  }
  return null;
}

export function presentTaskResolution(resolution: TaskResolution): EngineerNotice {
  if (resolution.state === "AMBIGUOUS") {
    const listed = resolution.candidates.map((candidate) => `${candidate.title} (${candidate.taskId})`).join("; ");
    return {
      backendState: "AMBIGUOUS",
      category: "attention",
      headline: "More than one task matched",
      explanation: `The portal did not choose a task. Candidates: ${listed}.`,
      nextAction: "Select one specific task. No preferred match is applied.",
      procedureVisible: false,
      technicalDetail: `AMBIGUOUS via ${resolution.match}`,
    };
  }
  if (resolution.state === "UNSUPPORTED" && resolution.reason === "excluded_software") {
    return {
      backendState: "UNSUPPORTED",
      category: "blocking",
      headline: "This software context is excluded",
      explanation: `${resolution.matchedExclusion ?? "The requested software"} is outside the package boundary. The task was not treated as missing.`,
      nextAction: "Stay inside the primary research boundary. No procedure is generated for excluded software.",
      procedureVisible: false,
      technicalDetail: "UNSUPPORTED excluded_software",
    };
  }
  if (resolution.state === "UNSUPPORTED") {
    return {
      backendState: "UNSUPPORTED",
      category: "attention",
      headline: "No matching catalog task",
      explanation: "No catalog identity matched this request. This is not an excluded-software result.",
      nextAction: "Choose a task from the catalog. The search text is not turned into a task.",
      procedureVisible: false,
      technicalDetail: "UNSUPPORTED no_match",
    };
  }
  if (resolution.state === "INVALID_INPUT") {
    return {
      backendState: "INVALID_INPUT",
      category: "attention",
      headline: "The task request is not usable",
      explanation:
        resolution.reason === "empty"
          ? "The task request is empty."
          : "The task request is not text.",
      nextAction: "Select a catalog task.",
      procedureVisible: false,
      technicalDetail: `INVALID_INPUT ${resolution.reason}`,
    };
  }
  if (resolution.state === "DATA_ERROR") {
    return dataErrorNotice(resolution.errors.map((error) => `${error.code}: ${error.message}`).join(" "));
  }
  return {
    backendState: "RESOLVED",
    category: "information",
    headline: resolution.task.title,
    explanation: "One catalog task matched. It was not chosen from a list of candidates.",
    nextAction: "Use the selected task.",
    procedureVisible: false,
    technicalDetail: `RESOLVED ${resolution.task.taskId}`,
  };
}

export function presentProcedureRun(run: ProcedureRun): EngineerNotice {
  if (run.kind === "VALIDATION") {
    return presentValidation(run.validation);
  }
  if (run.kind === "DATA_ERROR") {
    return dataErrorNotice(run.errors.map((error) => `${error.code}: ${error.message}`).join(" "));
  }
  if (run.kind === "GENERATED") {
    return {
      backendState: "GENERATED",
      category: "application",
      headline: "Procedure generated as guidance",
      explanation: `The application assembled a procedure for ${run.procedure.taskId}. Coverage ${run.procedure.support.taskCoverageStatus}. Completeness claim ${String(run.procedure.support.completenessClaim)}. Lab validation ${String(run.procedure.support.labValidation)}. Validation ${run.procedure.support.validationStatus ?? run.procedure.validationStatus}. Device execution is not authorized. This is not a device test and not a production-ready claim.`,
      nextAction: "Read the procedure as guidance. Do not treat generation as permission to run commands on a device.",
      procedureVisible: true,
      technicalDetail: "GENERATED",
    };
  }
  return presentBlocked(run.state, run.reason, run.messages, run.candidates, run.matchedExclusion);
}

export function presentUnavailableForm(form: {
  state: string;
  errors: readonly { code: string; message: string }[];
} | undefined): EngineerNotice {
  const error = form?.errors[0];
  if (form?.state === "UNSUPPORTED_VALIDATION") {
    return {
      backendState: "UNSUPPORTED_VALIDATION",
      category: "attention",
      headline: "Validation is not established",
      explanation:
        error?.message ??
        "The portal does not have an input contract for this task. That does not mark a supplied value invalid. No procedure form is shown.",
      nextAction: "Do not generate a procedure for this task.",
      procedureVisible: false,
      technicalDetail: error?.code ?? "UNSUPPORTED_VALIDATION",
    };
  }
  return {
    backendState: "DATA_ERROR",
    category: "blocking",
    headline: "The input contract is not available",
    explanation: error?.message ?? "No procedure form is shown because the task input contract could not be established.",
    nextAction: "Procedure generation cannot continue from this task.",
    procedureVisible: false,
    technicalDetail: error?.code ?? "DATA_ERROR",
  };
}

export function presentSearchMiss(text: string): EngineerNotice {
  const quoted = text.trim();
  return {
    backendState: "NO_MATCHES",
    category: "information",
    headline: "No matching catalog task",
    explanation: quoted
      ? `No catalog task matches “${quoted}”. No task identity was created from the search text, and no close match was selected.`
      : "No catalog task matches this filter. No task identity was created, and no close match was selected.",
    nextAction: "Change the search text or category. The catalog remains loaded.",
    procedureVisible: false,
    technicalDetail: "NO_MATCHES",
  };
}

export function presentLoaderFailure(errors: readonly { code: string; message: string }[]): EngineerNotice {
  return {
    ...dataErrorNotice(errors.map((error) => `${error.code}: ${error.message}`).join(" ")),
    headline: "The knowledge base did not load safely",
    explanation:
      "Task and procedure work is unavailable because the knowledge package did not load. This is not the same as a search with no matching tasks. No substitute catalog is shown.",
  };
}

export function sourceBoundaryNote(
  source: { platformBoundary: string; releaseBoundary: string },
  primary: { platform: string; software: string; release: string },
): string | null {
  const recorded = `${source.platformBoundary} ${source.releaseBoundary}`;
  if (recorded.includes(primary.software) && recorded.includes(primary.release)) {
    return null;
  }
  return "This source boundary is recorded separately from the package primary boundary. It is not rewritten to that release.";
}

function presentBlocked(
  state: string,
  reason: string,
  messages: readonly string[],
  candidates: readonly { taskId: string; title: string }[],
  matchedExclusion: string | null,
): EngineerNotice {
  const detail = messages.filter(Boolean).join(" ");
  if (state === "AMBIGUOUS") {
    const listed = candidates.map((candidate) => `${candidate.title} (${candidate.taskId})`).join("; ");
    return {
      backendState: "AMBIGUOUS",
      category: "attention",
      headline: "More than one task matched",
      explanation: listed
        ? `The portal did not choose a task. Candidates: ${listed}.`
        : "The portal did not choose a task because more than one identity matched.",
      nextAction: "Select one specific task.",
      procedureVisible: false,
      technicalDetail: "AMBIGUOUS",
    };
  }
  if (state === "INCOMPLETE_PROCEDURE") {
    return {
      backendState: "INCOMPLETE_PROCEDURE",
      category: "blocking",
      headline: "The procedure failed completeness checks",
      explanation: detail || "The procedure generator did not accept the result as complete.",
      nextAction: "Do not use this result as a procedure. Device execution remains unauthorized.",
      procedureVisible: false,
      technicalDetail: `INCOMPLETE_PROCEDURE ${reason}`,
    };
  }
  if (state === "DATA_ERROR") {
    return dataErrorNotice(detail || reason);
  }
  if (state === "UPSTREAM_NOT_READY") {
    return {
      backendState: "UPSTREAM_NOT_READY",
      category: "blocking",
      headline: "An earlier step was not ready",
      explanation: earlierIssue(reason, detail, "Generation stopped because an earlier validation or workflow step was not ready."),
      nextAction: "Correct the earlier condition. A procedure is not shown for this request.",
      procedureVisible: false,
      technicalDetail: `UPSTREAM_NOT_READY ${reason}`,
    };
  }
  if (state === "UPSTREAM_NOT_RENDERED") {
    return {
      backendState: "UPSTREAM_NOT_RENDERED",
      category: "blocking",
      headline: "Commands were not rendered",
      explanation: earlierIssue(reason, detail, "The procedure was not assembled because command rendering did not complete."),
      nextAction: "No procedure is shown. Device execution remains unauthorized.",
      procedureVisible: false,
      technicalDetail: `UPSTREAM_NOT_RENDERED ${reason}`,
    };
  }
  if (state === "WORKFLOW_NOT_ESTABLISHED" || reason === "procedure_not_established" || reason === "command_only") {
    return {
      backendState: state,
      category: "attention",
      headline: "Workflow not established",
      explanation: "This task is known, but a governed procedure is not established. Procedure not available.",
      nextAction: "Do not generate a procedure for this task.",
      procedureVisible: false,
      technicalDetail: `${state} ${reason}`,
    };
  }
  if (state === "UNSUPPORTED" && (reason === "excluded_software" || matchedExclusion)) {
    return {
      backendState: "UNSUPPORTED",
      category: "blocking",
      headline: "This software context is excluded",
      explanation: `${matchedExclusion ?? "The requested software"} is outside the package boundary.`,
      nextAction: "No procedure is generated for excluded software.",
      procedureVisible: false,
      technicalDetail: "UNSUPPORTED excluded_software",
    };
  }
  if (state === "UNSUPPORTED") {
    return {
      backendState: "UNSUPPORTED",
      category: "attention",
      headline: "No matching catalog task",
      explanation: detail || "No catalog identity matched this request.",
      nextAction: "Choose a task from the catalog.",
      procedureVisible: false,
      technicalDetail: `UNSUPPORTED ${reason}`,
    };
  }
  return {
    backendState: state,
    category: "blocking",
    headline: "The request cannot continue",
    explanation: detail || `The backend returned ${state}.`,
    nextAction: "No procedure is shown for this request. Device execution remains unauthorized.",
    procedureVisible: false,
    technicalDetail: `${state} ${reason}`,
  };
}

function earlierIssue(reason: string, detail: string, fallback: string): string {
  if (reason === "input_not_ready") {
    return `Generation stopped because the inputs were not ready. ${detail}`.trim();
  }
  if (reason === "command_only" || reason === "procedure_not_established") {
    return "Generation stopped because no workflow is established for this task.";
  }
  return detail ? `${fallback} ${detail}` : fallback;
}

function dataErrorNotice(detail: string): EngineerNotice {
  return {
    backendState: "DATA_ERROR",
    category: "blocking",
    headline: "Knowledge data could not be validated",
    explanation: `Procedure generation cannot continue. ${detail}`.trim(),
    nextAction: "Reload after the knowledge package is restored. No substitute procedure is available.",
    procedureVisible: false,
    technicalDetail: detail || "DATA_ERROR",
  };
}

function uniqueConstraints(items: readonly { parameterName: string; constraint: string }[]): string[] {
  return [...new Set(items.map((item) => `${item.parameterName} ${item.constraint}`))];
}
