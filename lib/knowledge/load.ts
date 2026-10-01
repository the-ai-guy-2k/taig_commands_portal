import path from "node:path";
import { REQUIRED_JSON_FILES, REQUIRED_JSON_FILENAMES } from "./constants";
import { dedupeAndSortErrors, type KnowledgeError } from "./errors";
import { buildKnowledgeIndexes } from "./indexes";
import { structuralDocuments, validateKnowledgeIntegrity } from "./integrity";
import { readKnowledgePackage } from "./read-package";
import { validateDatasetAgainstSchema } from "./schema";
import type { LoadedKnowledge } from "./types";

export interface LoadKnowledgeOptions {
  packageRoot?: string;
}

export type LoadResult =
  | { ok: true; knowledge: LoadedKnowledge }
  | { ok: false; errors: KnowledgeError[] };

export function defaultKnowledgeRoot(): string {
  return path.join(process.cwd(), "cisco_command_results");
}

export async function loadKnowledgePackage(options: LoadKnowledgeOptions = {}): Promise<LoadResult> {
  const packageRoot = options.packageRoot ?? defaultKnowledgeRoot();
  const parsed = await readKnowledgePackage(packageRoot);
  const errors: KnowledgeError[] = [...parsed.errors];

  const requiredReady =
    parsed.directory !== null &&
    REQUIRED_JSON_FILENAMES.every((filename) => {
      const file = parsed.jsonFiles.get(filename);
      return Boolean(file && file.parseError === undefined && file.value !== undefined);
    });

  if (requiredReady) {
    const dataset = parsed.jsonFiles.get(REQUIRED_JSON_FILES.dataset)?.value;
    const schema = parsed.jsonFiles.get(REQUIRED_JSON_FILES.schema)?.value;
    errors.push(...validateDatasetAgainstSchema(schema, dataset));
    const structured = structuralDocuments(parsed);
    errors.push(...structured.errors);
    if (structured.documents) {
      errors.push(...validateKnowledgeIntegrity(structured.documents, parsed));
      if (errors.length === 0 && parsed.directory) {
        return {
          ok: true,
          knowledge: {
            directory: parsed.directory,
            manifest: structured.documents.manifest,
            dataset: structured.documents.dataset,
            taxonomy: structured.documents.taxonomy,
            workflows: structured.documents.workflows,
            sourceIndex: structured.documents.sourceIndex,
            coverage: structured.documents.coverage,
            schema: structured.documents.schema,
            indexes: buildKnowledgeIndexes(structured.documents.dataset, structured.documents.coverage),
          },
        };
      }
    }
  }

  return { ok: false, errors: dedupeAndSortErrors(errors) };
}
