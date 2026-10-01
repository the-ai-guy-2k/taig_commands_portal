import { normalizeTaskInput } from "../tasks/normalize";
import type { DiscoveryQuery, DiscoveryTask } from "./types";

export function filterDiscoveryTasks(
  tasks: readonly DiscoveryTask[],
  query: DiscoveryQuery,
): DiscoveryTask[] {
  const text = normalizeTaskInput(query.text);
  return tasks.filter((task) => {
    if (query.categoryId && task.categoryId !== query.categoryId) {
      return false;
    }
    if (!text) {
      return true;
    }
    const fields = [task.taskId, task.title, task.categoryLabel, ...task.aliases];
    return fields.some((field) => normalizeTaskInput(field).includes(text));
  });
}
