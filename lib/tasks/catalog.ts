import {
  INITIAL_VERTICAL_SLICE_TASK_IDS,
  READ_ONLY_ROLLBACK_STRATEGY,
  TASK_COVERAGE_COMMAND_ONLY,
  TASK_COVERAGE_WORKFLOW_BACKED,
} from "./constants";
import { normalizeTaskInput } from "./normalize";
import type {
  ActivityEvidence,
  CatalogBuildResult,
  CatalogCategory,
  CatalogTask,
  TaskCatalog,
  TaskDataError,
  TaskWorkflowAvailability,
} from "./types";
import type { LoadedKnowledge, TaskRecord, TaskWorkflow } from "../knowledge/types";
import { isNonEmptyString, isStringArray } from "../knowledge/guards";

function dataError(code: TaskDataError["code"], message: string, taskId?: string): TaskDataError {
  return { code, message, taskId };
}

function appendTask(map: Map<string, CatalogTask[]>, key: string, task: CatalogTask): void {
  const existing = map.get(key);
  if (!existing) {
    map.set(key, [task]);
    return;
  }
  if (!existing.some((item) => item.taskId === task.taskId)) {
    existing.push(task);
  }
}

function classifyWorkflow(workflow: TaskWorkflow): ActivityEvidence | null {
  const configuration = workflow.phases?.configuration;
  if (!Array.isArray(configuration) || !isNonEmptyString(workflow.rollback?.strategy)) {
    return null;
  }
  if (configuration.length === 0 && workflow.rollback.strategy === READ_ONLY_ROLLBACK_STRATEGY) {
    return "read_only";
  }
  if (configuration.length > 0) {
    return "configuration_changing";
  }
  return "not_established";
}

function activityFor(labels: ActivityEvidence[]): ActivityEvidence {
  if (labels.length === 0) {
    return "not_established";
  }
  if (labels.every((label) => label === "read_only")) {
    return "read_only";
  }
  if (labels.every((label) => label === "configuration_changing")) {
    return "configuration_changing";
  }
  return "not_established";
}

function workflowShapeError(workflow: TaskWorkflow, taskId: string): TaskDataError | null {
  const phases = workflow.phases;
  if (!phases || !Array.isArray(phases.pre_check) || !Array.isArray(phases.configuration) || !Array.isArray(phases.verification) || !Array.isArray(phases.troubleshooting)) {
    return dataError(
      "MALFORMED_WORKFLOW",
      `Workflow ${workflow.workflow_id} does not expose the four ordered phase arrays.`,
      taskId,
    );
  }
  if (!isNonEmptyString(workflow.platform_boundary) || !isNonEmptyString(workflow.rollback?.strategy) || !isNonEmptyString(workflow.validation_status) || !isStringArray(workflow.intent_aliases)) {
    return dataError(
      "MALFORMED_WORKFLOW",
      `Workflow ${workflow.workflow_id} is missing platform, rollback, validation, or intent alias fields.`,
      taskId,
    );
  }
  return null;
}

function resolutionAliases(task: TaskRecord, workflows: TaskWorkflow[]): string[] {
  const aliases = [...task.aliases];
  const seen = new Set(aliases.map((alias) => normalizeTaskInput(alias)));
  for (const workflow of workflows) {
    for (const alias of workflow.intent_aliases) {
      const key = normalizeTaskInput(alias);
      if (key.length === 0 || seen.has(key)) {
        continue;
      }
      seen.add(key);
      aliases.push(alias);
    }
  }
  return aliases;
}

export function buildTaskCatalog(knowledge: LoadedKnowledge): CatalogBuildResult {
  const errors: TaskDataError[] = [];
  const tasks: CatalogTask[] = [];
  const byId = new Map<string, CatalogTask[]>();
  const byTitle = new Map<string, CatalogTask[]>();
  const byAlias = new Map<string, CatalogTask[]>();
  let aliasStrings = 0;

  for (const task of knowledge.dataset.tasks) {
    if (!isNonEmptyString(task.task_id) || !isNonEmptyString(task.title) || normalizeTaskInput(task.title).length === 0 || !isNonEmptyString(task.category_id) || !isNonEmptyString(task.coverage_status) || !isStringArray(task.aliases) || !isStringArray(task.workflow_ids) || task.aliases.some((alias) => !isNonEmptyString(alias) || normalizeTaskInput(alias).length === 0) || task.workflow_ids.some((workflowId) => !isNonEmptyString(workflowId))) {
      errors.push(dataError("MALFORMED_TASK", "A task record is missing its id, title, category, coverage status, aliases, or workflow ids.", task.task_id));
      continue;
    }

    const category = knowledge.indexes.categoriesById.get(task.category_id);
    if (!category || !isNonEmptyString(category.label) || !isNonEmptyString(category.coverage_status)) {
      errors.push(dataError("MISSING_CATEGORY", `Task ${task.task_id} category ${task.category_id} does not resolve.`, task.task_id));
      continue;
    }

    const workflowRecords: TaskWorkflow[] = [];
    let workflowBroken = false;
    for (const workflowId of task.workflow_ids) {
      const workflow = knowledge.indexes.workflowsById.get(workflowId);
      if (!workflow) {
        workflowBroken = true;
        errors.push(dataError("MISSING_WORKFLOW", `Task ${task.task_id} references missing workflow ${workflowId}.`, task.task_id));
        continue;
      }
      if (workflow.task_id !== task.task_id) {
        workflowBroken = true;
        errors.push(
          dataError(
            "WORKFLOW_TASK_MISMATCH",
            `Workflow ${workflowId} belongs to ${workflow.task_id}, not ${task.task_id}.`,
            task.task_id,
          ),
        );
        continue;
      }
      const shapeError = workflowShapeError(workflow, task.task_id);
      if (shapeError) {
        workflowBroken = true;
        errors.push(shapeError);
        continue;
      }
      workflowRecords.push(workflow);
    }
    if (workflowBroken) {
      continue;
    }

    const workflowBacked = task.workflow_ids.length > 0;
    if (workflowBacked && task.coverage_status !== TASK_COVERAGE_WORKFLOW_BACKED) {
      errors.push(
        dataError(
          "COVERAGE_STATUS_MISMATCH",
          `Task ${task.task_id} has a workflow but coverage_status is ${task.coverage_status}.`,
          task.task_id,
        ),
      );
      continue;
    }
    if (!workflowBacked && task.coverage_status !== TASK_COVERAGE_COMMAND_ONLY) {
      errors.push(
        dataError(
          "COVERAGE_STATUS_MISMATCH",
          `Task ${task.task_id} has no workflow but coverage_status is ${task.coverage_status}.`,
          task.task_id,
        ),
      );
      continue;
    }

    const workflows: TaskWorkflowAvailability[] = workflowRecords.map((workflow) => ({
      workflowId: workflow.workflow_id,
      platformBoundary: workflow.platform_boundary,
      rollbackStrategy: workflow.rollback.strategy,
      configurationStepCount: workflow.phases.configuration.length,
      validationStatus: workflow.validation_status,
    }));
    const activityLabels = workflowRecords.map((workflow) => classifyWorkflow(workflow) ?? "not_established");
    const aliases = resolutionAliases(task, workflowRecords);
    aliasStrings += aliases.length;
    const coverage = knowledge.indexes.coverageByCategoryId.get(task.category_id);
    const catalogTask: CatalogTask = {
      taskId: task.task_id,
      title: task.title,
      aliases,
      categoryId: category.category_id,
      categoryLabel: category.label,
      categoryType: category.type,
      categoryCoverageStatus: category.coverage_status,
      coverageStatus: task.coverage_status,
      coverageRowStatus: coverage?.status ?? null,
      workflowAvailability: workflowBacked ? "present" : "absent",
      workflows,
      activityEvidence: activityFor(activityLabels),
      inInitialVerticalSlice: INITIAL_VERTICAL_SLICE_TASK_IDS.includes(task.task_id as (typeof INITIAL_VERTICAL_SLICE_TASK_IDS)[number]),
      validationStatus: workflows[0]?.validationStatus ?? null,
    };
    tasks.push(catalogTask);
    appendTask(byId, normalizeTaskInput(catalogTask.taskId), catalogTask);
    appendTask(byTitle, normalizeTaskInput(catalogTask.title), catalogTask);
    for (const alias of aliases) {
      appendTask(byAlias, normalizeTaskInput(alias), catalogTask);
    }
  }

  if (errors.length > 0) {
    return { ok: false, state: "DATA_ERROR", errors };
  }

  const taskCounts = new Map<string, number>();
  for (const task of tasks) {
    taskCounts.set(task.categoryId, (taskCounts.get(task.categoryId) ?? 0) + 1);
  }
  const categories: CatalogCategory[] = knowledge.dataset.task_categories.map((category) => ({
    categoryId: category.category_id,
    label: category.label,
    type: category.type,
    parentId: category.parent_id,
    coverageStatus: category.coverage_status,
    taskCount: taskCounts.get(category.category_id) ?? 0,
  }));
  categories.sort((left, right) => left.categoryId.localeCompare(right.categoryId));
  tasks.sort((left, right) => left.taskId.localeCompare(right.taskId));

  const boundary = knowledge.dataset.platform_version_metadata?.primary_boundary;
  const excludedSoftware = knowledge.dataset.platform_version_metadata?.excluded_software;
  if (!boundary || !isNonEmptyString(boundary.platform) || !isNonEmptyString(boundary.software) || !isNonEmptyString(boundary.release) || !Array.isArray(excludedSoftware)) {
    return {
      ok: false,
      state: "DATA_ERROR",
      errors: [dataError("KNOWLEDGE_DATA_ERROR", "Platform boundary metadata is missing from the loaded knowledge package.")],
    };
  }

  const catalog: TaskCatalog = {
    package: {
      directory: knowledge.directory,
      schemaVersion: knowledge.dataset.metadata.schema_version,
      datasetVersion: knowledge.dataset.metadata.dataset_version,
      status: knowledge.dataset.metadata.status,
      completenessClaim: knowledge.dataset.metadata.completeness_claim,
      labValidation: knowledge.dataset.metadata.lab_validation,
      coverageBoundary: knowledge.dataset.metadata.coverage_boundary,
      primaryBoundary: {
        platform: boundary.platform,
        software: boundary.software,
        release: boundary.release,
      },
      excludedSoftware: [...excludedSoftware],
    },
    tasks,
    categories,
    counts: {
      tasks: tasks.length,
      workflowBacked: tasks.filter((task) => task.workflowAvailability === "present").length,
      commandOnly: tasks.filter((task) => task.workflowAvailability === "absent").length,
      aliasStrings,
      normalizedAliasKeys: byAlias.size,
      categories: categories.length,
    },
    tasksByNormalizedId: byId,
    tasksByNormalizedTitle: byTitle,
    tasksByNormalizedAlias: byAlias,
  };
  return { ok: true, catalog };
}

export function listTasks(catalog: TaskCatalog): readonly CatalogTask[] {
  return catalog.tasks;
}

export function listTaskCategories(catalog: TaskCatalog): readonly CatalogCategory[] {
  return catalog.categories;
}
