import type { PhaseName } from "../knowledge/constants";
import type { ActivityEvidence } from "../tasks";
import type { WorkflowSupport } from "../workflows/types";

export const RENDER_STATES = [
  "RENDERED",
  "UPSTREAM_NOT_READY",
  "UNRESOLVED_PLACEHOLDER",
  "BINDING_ERROR",
  "DATA_ERROR",
  "UNSUPPORTED",
] as const;

export type RenderState = (typeof RENDER_STATES)[number];

export interface RenderSubstitution {
  placeholder: string;
  engineerInputKey: string;
  engineerValue: string;
  researchValue: string | number | null;
}

export interface RenderedCommand {
  taskId: string;
  workflowId: string;
  phase: PhaseName;
  stepIndex: number;
  commandId: string;
  template: string;
  renderedCommand: string;
  substitutions: readonly RenderSubstitution[];
  cliModes: readonly string[];
  entryContext: string | null;
  platformFamily: readonly string[];
  softwareFamily: string;
  versionNotes: string;
  workflowPlatformBoundary: string;
  supportStatus: string;
  validationStatus: string;
  operationalRisk: {
    effect: string;
    level: string;
    caution: string | null;
  };
  sourceIds: readonly string[];
  coverageStatus: string;
  engineerInputKeys: readonly string[];
}

export interface RenderedPhase {
  phase: PhaseName;
  commands: readonly RenderedCommand[];
}

export interface RenderedWorkflow {
  workflowId: string;
  platformBoundary: string;
  phases: readonly RenderedPhase[];
}

export interface RenderFailure {
  code:
    | "MISSING_TEMPLATE"
    | "MALFORMED_TEMPLATE"
    | "UNRESOLVED_PLACEHOLDER"
    | "BINDING_ERROR"
    | "CREDENTIAL_PLACEHOLDER"
    | "UPSTREAM_MISMATCH";
  message: string;
  commandId?: string;
  phase?: PhaseName;
  stepIndex?: number;
}

interface RenderFlags {
  taskId: string | null;
  upstreamState: string | null;
  deviceExecutionAuthorized: false;
  procedureGenerated: false;
}

export interface RenderedCommandResult extends RenderFlags {
  state: "RENDERED";
  taskId: string;
  activityEvidence: ActivityEvidence;
  workflows: readonly RenderedWorkflow[];
  support: WorkflowSupport;
  failures: readonly [];
}

export interface BlockedRenderResult extends RenderFlags {
  state: Exclude<RenderState, "RENDERED">;
  failures: readonly RenderFailure[];
}

export type RenderResult = RenderedCommandResult | BlockedRenderResult;
