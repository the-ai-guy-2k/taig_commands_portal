import type { CatalogBuildResult, CatalogTask, TaskCatalog } from "../tasks/types";
import type { DiscoveryCatalog, DiscoveryPageModel, DiscoveryTask } from "./types";

export function toDiscoveryCatalog(catalog: TaskCatalog): DiscoveryCatalog {
  return {
    status: catalog.package.status,
    completenessClaim: catalog.package.completenessClaim,
    labValidation: catalog.package.labValidation,
    primaryBoundary: {
      platform: catalog.package.primaryBoundary.platform,
      software: catalog.package.primaryBoundary.software,
      release: catalog.package.primaryBoundary.release,
    },
    excludedSoftware: [...catalog.package.excludedSoftware],
    counts: {
      tasks: catalog.counts.tasks,
      workflowBacked: catalog.counts.workflowBacked,
      commandOnly: catalog.counts.commandOnly,
    },
    categories: catalog.categories
      .filter((category) => category.taskCount > 0)
      .map((category) => ({
        categoryId: category.categoryId,
        label: category.label,
        taskCount: category.taskCount,
      })),
    tasks: catalog.tasks.map(toDiscoveryTask),
  };
}

function toDiscoveryTask(task: CatalogTask): DiscoveryTask {
  const boundaries = [...new Set(task.workflows.map((workflow) => workflow.platformBoundary))];
  return {
    taskId: task.taskId,
    title: task.title,
    aliases: [...task.aliases],
    categoryId: task.categoryId,
    categoryLabel: task.categoryLabel,
    coverageStatus: task.coverageStatus,
    workflowAvailability: task.workflowAvailability,
    activityEvidence: task.activityEvidence,
    platformBoundary: boundaries.length > 0 ? boundaries.join(" | ") : null,
    validationStatus: task.validationStatus,
    inInitialVerticalSlice: task.inInitialVerticalSlice,
  };
}

export function discoveryPageModel(result: CatalogBuildResult): DiscoveryPageModel {
  if (!result.ok) {
    return {
      state: "DATA_ERROR",
      errors: result.errors.map((error) => ({ code: error.code, message: error.message })),
    };
  }
  return { state: "READY", catalog: toDiscoveryCatalog(result.catalog) };
}
