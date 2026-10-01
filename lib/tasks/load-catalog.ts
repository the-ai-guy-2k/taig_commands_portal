import { loadKnowledgePackage, type LoadKnowledgeOptions } from "../knowledge";
import type { KnowledgeError } from "../knowledge/errors";
import { buildTaskCatalog } from "./catalog";
import type { CatalogBuildResult, TaskDataError } from "./types";

function knowledgeDataError(errors: readonly KnowledgeError[]): TaskDataError {
  const summary = errors.map((error) => error.code).join(", ") || "KNOWLEDGE_DATA_ERROR";
  return {
    code: "KNOWLEDGE_DATA_ERROR",
    message: `Knowledge package did not load: ${summary}`,
  };
}

export async function loadTaskCatalog(options: LoadKnowledgeOptions = {}): Promise<CatalogBuildResult> {
  const loaded = await loadKnowledgePackage(options);
  if (!loaded.ok) {
    return { ok: false, state: "DATA_ERROR", errors: [knowledgeDataError(loaded.errors)] };
  }
  return buildTaskCatalog(loaded.knowledge);
}
