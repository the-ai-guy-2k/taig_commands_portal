export const KNOWLEDGE_ERROR_CODES = [
  "MISSING_FILE",
  "INVALID_JSON",
  "SCHEMA_MISMATCH",
  "DUPLICATE_IDENTIFIER",
  "MISSING_REFERENCED_TASK",
  "MISSING_REFERENCED_WORKFLOW",
  "MISSING_REFERENCED_COMMAND",
  "MALFORMED_COMMAND",
  "UNRESOLVED_REFERENCE",
  "INVALID_TEMPLATE_METADATA",
  "MISSING_SOURCE_REFERENCE",
  "MALFORMED_COVERAGE",
  "MALFORMED_KNOWN_GAP",
  "INCONSISTENT_MANIFEST",
  "INTERNAL_INCONSISTENCY",
] as const;

export type KnowledgeErrorCode = (typeof KNOWLEDGE_ERROR_CODES)[number];

export interface KnowledgeError {
  code: KnowledgeErrorCode;
  message: string;
  path?: string;
  entityId?: string;
}

export function knowledgeError(
  code: KnowledgeErrorCode,
  message: string,
  path?: string,
  entityId?: string,
): KnowledgeError {
  return { code, message, path, entityId };
}

export function dedupeAndSortErrors(errors: KnowledgeError[]): KnowledgeError[] {
  const seen = new Set<string>();
  const unique: KnowledgeError[] = [];
  for (const error of errors) {
    const key = `${error.code}\u0000${error.path ?? ""}\u0000${error.entityId ?? ""}\u0000${error.message}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(error);
  }
  unique.sort((left, right) => {
    return (
      left.code.localeCompare(right.code) ||
      (left.path ?? "").localeCompare(right.path ?? "") ||
      (left.entityId ?? "").localeCompare(right.entityId ?? "") ||
      left.message.localeCompare(right.message)
    );
  });
  return unique;
}
