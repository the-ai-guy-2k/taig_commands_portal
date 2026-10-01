import type { CoverageDocument, DatasetDocument, KnowledgeIndexes } from "./types";

export function buildKnowledgeIndexes(
  dataset: DatasetDocument,
  coverage: CoverageDocument,
): KnowledgeIndexes {
  const commandsCitingTask = new Map<string, DatasetDocument["commands"]>();
  for (const task of dataset.tasks) {
    commandsCitingTask.set(task.task_id, []);
  }
  for (const command of dataset.commands) {
    for (const taskId of command.task_ids) {
      const existing = commandsCitingTask.get(taskId);
      if (existing) {
        existing.push(command);
      }
    }
  }

  return {
    categoriesById: new Map(dataset.task_categories.map((category) => [category.category_id, category])),
    tasksById: new Map(dataset.tasks.map((task) => [task.task_id, task])),
    workflowsById: new Map(dataset.task_workflows.map((workflow) => [workflow.workflow_id, workflow])),
    commandsById: new Map(dataset.commands.map((command) => [command.command_id, command])),
    sourcesById: new Map(dataset.sources.map((source) => [source.source_id, source])),
    familiesById: new Map(dataset.command_families.map((family) => [family.family_id, family])),
    coverageByCategoryId: new Map(coverage.coverage.map((item) => [item.category_id, item])),
    commandsCitingTask,
  };
}
