import type { ActivityEvidence, WorkflowAvailability } from "../tasks/types";

export interface DiscoveryTask {
  taskId: string;
  title: string;
  aliases: readonly string[];
  categoryId: string;
  categoryLabel: string;
  coverageStatus: string;
  workflowAvailability: WorkflowAvailability;
  activityEvidence: ActivityEvidence;
  platformBoundary: string | null;
  validationStatus: string | null;
  inInitialVerticalSlice: boolean;
}

export interface DiscoveryCategory {
  categoryId: string;
  label: string;
  taskCount: number;
}

export interface DiscoveryCatalog {
  status: string;
  completenessClaim: boolean;
  labValidation: boolean;
  primaryBoundary: {
    platform: string;
    software: string;
    release: string;
  };
  excludedSoftware: readonly string[];
  counts: {
    tasks: number;
    workflowBacked: number;
    commandOnly: number;
  };
  categories: readonly DiscoveryCategory[];
  tasks: readonly DiscoveryTask[];
}

export interface DiscoveryQuery {
  text: string;
  categoryId: string | null;
}

export interface SelectedTaskHandoff {
  taskId: string;
  title: string;
  categoryId: string;
  categoryLabel: string;
  workflowAvailability: WorkflowAvailability;
  coverageStatus: string;
  activityEvidence: ActivityEvidence;
  platformBoundary: string | null;
  validationStatus: string | null;
}

export interface DiscoveryPageError {
  code: string;
  message: string;
}

export type DiscoveryPageModel =
  | { state: "DATA_ERROR"; errors: readonly DiscoveryPageError[] }
  | { state: "READY"; catalog: DiscoveryCatalog };
