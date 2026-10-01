import { normalizeTaskInput } from "./normalize";
import type {
  CatalogTask,
  MatchStage,
  TaskCatalog,
  TaskResolution,
  TaskSelectionContext,
} from "./types";

function uniqueTasks(tasks: readonly CatalogTask[] | undefined): CatalogTask[] {
  if (!tasks) {
    return [];
  }
  const seen = new Set<string>();
  const unique: CatalogTask[] = [];
  for (const task of tasks) {
    if (seen.has(task.taskId)) {
      continue;
    }
    seen.add(task.taskId);
    unique.push(task);
  }
  unique.sort((left, right) => left.taskId.localeCompare(right.taskId));
  return unique;
}

function excludedSoftware(catalog: TaskCatalog, context: TaskSelectionContext | undefined): string | null {
  if (!context) {
    return null;
  }
  const excluded = new Map(catalog.package.excludedSoftware.map((entry) => [normalizeTaskInput(entry), entry]));
  for (const candidate of [context.software, context.platform]) {
    if (typeof candidate !== "string") {
      continue;
    }
    const match = excluded.get(normalizeTaskInput(candidate));
    if (match) {
      return match;
    }
  }
  return null;
}

function matchedAlias(task: CatalogTask, normalizedInput: string): string | null {
  return task.aliases.find((alias) => normalizeTaskInput(alias) === normalizedInput) ?? null;
}

function finishStage(stage: MatchStage, tasks: readonly CatalogTask[], normalizedInput: string): TaskResolution | null {
  if (tasks.length === 0) {
    return null;
  }
  if (tasks.length > 1) {
    return {
      state: "AMBIGUOUS",
      normalizedInput,
      match: stage,
      candidates: tasks.map((task) => ({ taskId: task.taskId, title: task.title })),
    };
  }
  const task = tasks[0];
  return {
    state: "RESOLVED",
    normalizedInput,
    match: stage,
    matchedAlias: stage === "alias" ? matchedAlias(task, normalizedInput) : null,
    task,
  };
}

export function getTaskById(catalog: TaskCatalog, taskId: string): TaskResolution {
  if (typeof taskId !== "string") {
    return { state: "INVALID_INPUT", reason: "not_a_string" };
  }
  const normalizedInput = normalizeTaskInput(taskId);
  if (normalizedInput.length === 0) {
    return { state: "INVALID_INPUT", reason: "empty" };
  }
  const found = finishStage("task_id", uniqueTasks(catalog.tasksByNormalizedId.get(normalizedInput)), normalizedInput);
  if (found) {
    return found;
  }
  return { state: "UNSUPPORTED", normalizedInput, reason: "no_match", matchedExclusion: null };
}

export function resolveTask(
  catalog: TaskCatalog,
  input: string,
  context?: TaskSelectionContext,
): TaskResolution {
  if (typeof input !== "string") {
    return { state: "INVALID_INPUT", reason: "not_a_string" };
  }
  const normalizedInput = normalizeTaskInput(input);
  if (normalizedInput.length === 0) {
    return { state: "INVALID_INPUT", reason: "empty" };
  }

  const exclusion = excludedSoftware(catalog, context);
  if (exclusion) {
    return {
      state: "UNSUPPORTED",
      normalizedInput,
      reason: "excluded_software",
      matchedExclusion: exclusion,
    };
  }

  return (
    finishStage("task_id", uniqueTasks(catalog.tasksByNormalizedId.get(normalizedInput)), normalizedInput) ??
    finishStage("task_name", uniqueTasks(catalog.tasksByNormalizedTitle.get(normalizedInput)), normalizedInput) ??
    finishStage("alias", uniqueTasks(catalog.tasksByNormalizedAlias.get(normalizedInput)), normalizedInput) ?? {
      state: "UNSUPPORTED",
      normalizedInput,
      reason: "no_match",
      matchedExclusion: null,
    }
  );
}
