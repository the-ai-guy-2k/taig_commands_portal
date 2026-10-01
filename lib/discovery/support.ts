import { presentTaskSupport } from "../coverage/present";
import type { ActivityEvidence, WorkflowAvailability } from "../tasks/types";
import type { DiscoveryTask, SelectedTaskHandoff } from "./types";

export function workflowLabel(availability: WorkflowAvailability): string {
  return availability === "present" ? "Workflow-backed" : "Command-only";
}

export function activityLabel(activity: ActivityEvidence): string {
  if (activity === "read_only") {
    return "Read-only";
  }
  if (activity === "configuration_changing") {
    return "Configuration-changing";
  }
  return "Not established";
}

export function selectionNotice(task: DiscoveryTask): string {
  const notice = presentTaskSupport(task);
  return `${notice.headline} ${notice.explanation}`;
}

export function selectedTaskHandoff(task: DiscoveryTask): SelectedTaskHandoff {
  return {
    taskId: task.taskId,
    title: task.title,
    categoryId: task.categoryId,
    categoryLabel: task.categoryLabel,
    workflowAvailability: task.workflowAvailability,
    coverageStatus: task.coverageStatus,
    activityEvidence: task.activityEvidence,
    platformBoundary: task.platformBoundary,
    validationStatus: task.validationStatus,
  };
}
