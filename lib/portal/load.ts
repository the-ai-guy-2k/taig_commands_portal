import { loadKnowledgePackage, type LoadKnowledgeOptions } from "../knowledge";
import { buildTaskCatalog } from "../tasks";
import { toDiscoveryCatalog } from "../discovery/view";
import type { DiscoveryCatalog, DiscoveryPageError } from "../discovery/types";
import { buildFormCatalog } from "./forms";
import type { TaskFormView } from "./types";

export type EngineerPortalModel =
  | { state: "DATA_ERROR"; errors: readonly DiscoveryPageError[] }
  | { state: "READY"; catalog: DiscoveryCatalog; forms: Record<string, TaskFormView> };

export async function loadEngineerPortal(options: LoadKnowledgeOptions = {}): Promise<EngineerPortalModel> {
  const loaded = await loadKnowledgePackage(options);
  if (!loaded.ok) {
    return {
      state: "DATA_ERROR",
      errors: loaded.errors.map((error) => ({ code: error.code, message: error.message })),
    };
  }
  const catalog = buildTaskCatalog(loaded.knowledge);
  if (!catalog.ok) {
    return {
      state: "DATA_ERROR",
      errors: catalog.errors.map((error) => ({ code: error.code, message: error.message })),
    };
  }
  return {
    state: "READY",
    catalog: toDiscoveryCatalog(catalog.catalog),
    forms: buildFormCatalog(loaded.knowledge, catalog.catalog),
  };
}
