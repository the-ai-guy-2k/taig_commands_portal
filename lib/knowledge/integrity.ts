import {
  CATEGORY_TYPES,
  COMMAND_KEYS,
  DATASET_ROOT_KEYS,
  DOCUMENTED_NOT_DEVICE_TESTED,
  FEATURE_COVERAGE_STATUSES,
  PARTITION_COVERAGE_STATUS,
  PHASE_NAMES,
  PHASE_RELATIONSHIP_TYPE,
  RELATIONSHIP_TYPES,
  REQUIRED_JSON_FILES,
  TASK_COVERAGE_WITH_WORKFLOW,
  TASK_COVERAGE_WITHOUT_WORKFLOW,
} from "./constants";
import { deepEqual } from "./deep-equal";
import { knowledgeError, type KnowledgeError } from "./errors";
import { isNonEmptyString, isNonEmptyStringArray, isRecord, isStringArray } from "./guards";
import { bytesForFilename, type ReadKnowledgePackage } from "./read-package";
import type {
  CommandRecord,
  CoverageDocument,
  DatasetDocument,
  ManifestDocument,
  PackageMetadata,
  SchemaDocument,
  SourceIndexDocument,
  SyntaxElement,
  TaskWorkflow,
  TaxonomyDocument,
  WorkflowsDocument,
  WorkflowStep,
} from "./types";

export interface IntegrityDocuments {
  dataset: DatasetDocument;
  taxonomy: TaxonomyDocument;
  workflows: WorkflowsDocument;
  sourceIndex: SourceIndexDocument;
  coverage: CoverageDocument;
  manifest: ManifestDocument;
  schema: SchemaDocument;
}

const METADATA_COUNT_FIELDS = [
  ["command_count", "commands"],
  ["workflow_count", "task_workflows"],
  ["source_count", "sources"],
] as const;

function push(errors: KnowledgeError[], error: KnowledgeError | null): void {
  if (error) {
    errors.push(error);
  }
}

function missingKey(
  record: Record<string, unknown>,
  key: string,
  pathName: string,
  code: KnowledgeError["code"],
  entityId?: string,
): KnowledgeError | null {
  if (!(key in record)) {
    return knowledgeError(code, `${pathName} is missing ${key}.`, pathName, entityId);
  }
  return null;
}

function duplicateIds(ids: string[], label: string, pathName: string): KnowledgeError[] {
  const seen = new Set<string>();
  const errors: KnowledgeError[] = [];
  for (const id of ids) {
    if (seen.has(id)) {
      errors.push(
        knowledgeError(
          "DUPLICATE_IDENTIFIER",
          `Duplicate ${label}: ${id}`,
          pathName,
          id,
        ),
      );
    }
    seen.add(id);
  }
  return errors;
}

function placeholdersInOrder(syntax: string): string[] {
  return [...syntax.matchAll(/<([^<>]+)>/g)].map((match) => match[1]);
}

function optionalPlaceholders(syntax: string): Set<string> {
  return new Set([...syntax.matchAll(/\[<([^<>]+)>\]/g)].map((match) => match[1]));
}

function syntaxHasUnparsedBrackets(syntax: string): boolean {
  const withoutOptional = syntax.replace(/\[<([^<>]+)>\]/g, "");
  return withoutOptional.includes("[") || withoutOptional.includes("]");
}

function validateMetadataShape(
  value: unknown,
  pathName: string,
  errors: KnowledgeError[],
): PackageMetadata | null {
  if (!isRecord(value)) {
    errors.push(knowledgeError("INCONSISTENT_MANIFEST", `${pathName} metadata must be an object.`, pathName));
    return null;
  }
  const required = [
    "aci",
    "schema_version",
    "dataset_version",
    "generated_at",
    "status",
    "completeness_claim",
    "coverage_boundary",
    "command_count",
    "workflow_count",
    "taxonomy_feature_group_count",
    "source_count",
    "lab_validation",
  ];
  let valid = true;
  for (const key of required) {
    if (!(key in value)) {
      valid = false;
      errors.push(
        knowledgeError("INCONSISTENT_MANIFEST", `${pathName} metadata is missing ${key}.`, `${pathName}.${key}`),
      );
    }
  }
  if (!valid) {
    return null;
  }
  const stringFields = [
    "aci",
    "schema_version",
    "dataset_version",
    "generated_at",
    "status",
    "coverage_boundary",
  ] as const;
  for (const key of stringFields) {
    if (!isNonEmptyString(value[key])) {
      errors.push(
        knowledgeError(
          "INCONSISTENT_MANIFEST",
          `${pathName} metadata.${key} must be a non-empty string.`,
          `${pathName}.${key}`,
        ),
      );
      valid = false;
    }
  }
  for (const key of ["command_count", "workflow_count", "taxonomy_feature_group_count", "source_count"] as const) {
    if (typeof value[key] !== "number" || !Number.isInteger(value[key])) {
      errors.push(
        knowledgeError(
          "INCONSISTENT_MANIFEST",
          `${pathName} metadata.${key} must be an integer.`,
          `${pathName}.${key}`,
        ),
      );
      valid = false;
    }
  }
  if (typeof value.completeness_claim !== "boolean" || typeof value.lab_validation !== "boolean") {
    errors.push(
      knowledgeError(
        "INCONSISTENT_MANIFEST",
        `${pathName} metadata completeness_claim and lab_validation must be booleans.`,
        pathName,
      ),
    );
    valid = false;
  }
  return valid ? (value as unknown as PackageMetadata) : null;
}

function validateSyntaxElements(
  command: Record<string, unknown>,
  errors: KnowledgeError[],
): SyntaxElement[] | null {
  const commandId = typeof command.command_id === "string" ? command.command_id : undefined;
  if (!Array.isArray(command.syntax_elements)) {
    errors.push(
      knowledgeError(
        "MALFORMED_COMMAND",
        `Command ${commandId ?? "(unknown)"} syntax_elements must be an array.`,
        "commands.syntax_elements",
        commandId,
      ),
    );
    return null;
  }
  const elements: SyntaxElement[] = [];
  const names = new Set<string>();
  let valid = true;
  command.syntax_elements.forEach((element, index) => {
    const elementPath = `commands.${commandId ?? index}.syntax_elements[${index}]`;
    if (!isRecord(element)) {
      valid = false;
      errors.push(
        knowledgeError("INVALID_TEMPLATE_METADATA", `${elementPath} must be an object.`, elementPath, commandId),
      );
      return;
    }
    for (const key of ["name", "description", "required", "range"]) {
      push(errors, missingKey(element, key, elementPath, "INVALID_TEMPLATE_METADATA", commandId));
    }
    if (!isNonEmptyString(element.name) || typeof element.description !== "string" || typeof element.required !== "boolean") {
      valid = false;
      errors.push(
        knowledgeError(
          "INVALID_TEMPLATE_METADATA",
          `${elementPath} name, description, and required flag are malformed.`,
          elementPath,
          commandId,
        ),
      );
      return;
    }
    if (!(element.range === null || typeof element.range === "string")) {
      valid = false;
      errors.push(
        knowledgeError(
          "INVALID_TEMPLATE_METADATA",
          `${elementPath} range must be a string or null. No numeric range grammar is encoded.`,
          elementPath,
          commandId,
        ),
      );
      return;
    }
    if (names.has(element.name)) {
      valid = false;
      errors.push(
        knowledgeError(
          "INVALID_TEMPLATE_METADATA",
          `Command ${element.name} is declared more than once on ${commandId}.`,
          elementPath,
          commandId,
        ),
      );
    }
    names.add(element.name);
    elements.push({
      name: element.name,
      description: element.description,
      required: element.required,
      range: element.range,
    });
  });
  return valid ? elements : null;
}

function validateCommandTemplate(
  command: Record<string, unknown>,
  elements: SyntaxElement[],
  errors: KnowledgeError[],
): void {
  const commandId = typeof command.command_id === "string" ? command.command_id : undefined;
  if (typeof command.syntax !== "string") {
    return;
  }
  if (syntaxHasUnparsedBrackets(command.syntax)) {
    errors.push(
      knowledgeError(
        "INVALID_TEMPLATE_METADATA",
        `Command ${commandId} contains bracket syntax outside [<placeholder>] optional markers.`,
        `commands.${commandId}.syntax`,
        commandId,
      ),
    );
  }
  const placeholders = placeholdersInOrder(command.syntax);
  const elementNames = elements.map((element) => element.name);
  if (placeholders.length !== elementNames.length || placeholders.some((name, index) => name !== elementNames[index])) {
    errors.push(
      knowledgeError(
        "INVALID_TEMPLATE_METADATA",
        `Command ${commandId} syntax placeholders [${placeholders.join(", ")}] do not match syntax_elements [${elementNames.join(", ")}].`,
        `commands.${commandId}.syntax`,
        commandId,
      ),
    );
  }
  const optional = optionalPlaceholders(command.syntax);
  for (const element of elements) {
    const isOptionalSyntax = optional.has(element.name);
    if (isOptionalSyntax !== (element.required === false)) {
      errors.push(
        knowledgeError(
          "INVALID_TEMPLATE_METADATA",
          `Command ${commandId} placeholder <${element.name}> optional syntax and required=${String(element.required)} disagree.`,
          `commands.${commandId}.syntax_elements`,
          commandId,
        ),
      );
    }
  }
}

function validateCommandRecord(value: unknown, index: number, errors: KnowledgeError[]): CommandRecord | null {
  const pathName = `commands[${index}]`;
  if (!isRecord(value)) {
    errors.push(knowledgeError("MALFORMED_COMMAND", `${pathName} must be an object.`, pathName));
    return null;
  }
  let valid = true;
  for (const key of COMMAND_KEYS) {
    if (!(key in value)) {
      valid = false;
      errors.push(knowledgeError("MALFORMED_COMMAND", `${pathName} is missing ${key}.`, pathName));
    }
  }
  if (!valid) {
    return null;
  }
  const commandId = isNonEmptyString(value.command_id) ? value.command_id : undefined;
  if (!commandId) {
    errors.push(knowledgeError("MALFORMED_COMMAND", `${pathName} command_id must be a non-empty string.`, pathName));
    return null;
  }
  const stringFields = [
    "command",
    "canonical_family",
    "task_category_id",
    "technology",
    "intent",
    "software_family",
    "version_notes",
    "device_feature_context",
    "syntax",
    "syntax_scope",
    "description",
    "when_to_use",
    "example",
    "example_type",
    "rollback_notes",
    "source_version",
    "deprecated_status",
    "support_status",
    "validation_status",
    "last_reviewed",
  ] as const;
  for (const key of stringFields) {
    if (!isNonEmptyString(value[key])) {
      valid = false;
      errors.push(
        knowledgeError("MALFORMED_COMMAND", `Command ${commandId} field ${key} must be a non-empty string.`, pathName, commandId),
      );
    }
  }
  for (const key of [
    "task_ids",
    "platform_family",
    "cli_modes",
    "prerequisites",
    "expected_output",
    "verification_command_ids",
    "troubleshooting_command_ids",
    "related_command_ids",
    "source_ids",
    "aliases",
    "notes",
  ] as const) {
    if (!isStringArray(value[key])) {
      valid = false;
      errors.push(
        knowledgeError("MALFORMED_COMMAND", `Command ${commandId} field ${key} must be an array of strings.`, pathName, commandId),
      );
    }
  }
  if (isStringArray(value.platform_family) && value.platform_family.length === 0) {
    valid = false;
    errors.push(
      knowledgeError("MALFORMED_COMMAND", `Command ${commandId} platform_family must not be empty.`, pathName, commandId),
    );
  }
  if (!(value.entry_context === null || typeof value.entry_context === "string")) {
    valid = false;
    errors.push(
      knowledgeError("MALFORMED_COMMAND", `Command ${commandId} entry_context must be a string or null.`, pathName, commandId),
    );
  }
  if (!(value.negation_removal === null || typeof value.negation_removal === "string")) {
    valid = false;
    errors.push(
      knowledgeError(
        "MALFORMED_COMMAND",
        `Command ${commandId} negation_removal must be a string or null.`,
        pathName,
        commandId,
      ),
    );
  }
  if (!isRecord(value.operational_risk)) {
    valid = false;
    errors.push(
      knowledgeError("MALFORMED_COMMAND", `Command ${commandId} operational_risk must be an object.`, pathName, commandId),
    );
  } else {
    const risk = value.operational_risk;
    if (!isNonEmptyString(risk.effect) || !isNonEmptyString(risk.level) || !(risk.caution === null || typeof risk.caution === "string")) {
      valid = false;
      errors.push(
        knowledgeError(
          "MALFORMED_COMMAND",
          `Command ${commandId} operational_risk effect, level, or caution is malformed.`,
          pathName,
          commandId,
        ),
      );
    }
  }
  if (!Array.isArray(value.source_evidence)) {
    valid = false;
    errors.push(
      knowledgeError("MALFORMED_COMMAND", `Command ${commandId} source_evidence must be an array.`, pathName, commandId),
    );
  } else {
    value.source_evidence.forEach((evidence, evidenceIndex) => {
      if (
        !isRecord(evidence) ||
        !isNonEmptyString(evidence.source_id) ||
        !isNonEmptyString(evidence.section) ||
        !isNonEmptyString(evidence.evidence_level)
      ) {
        valid = false;
        errors.push(
          knowledgeError(
            "MALFORMED_COMMAND",
            `Command ${commandId} source_evidence[${evidenceIndex}] is malformed.`,
            pathName,
            commandId,
          ),
        );
      }
    });
  }
  const elements = validateSyntaxElements(value, errors);
  if (!elements) {
    valid = false;
  } else {
    validateCommandTemplate(value, elements, errors);
  }
  return valid ? (value as unknown as CommandRecord) : null;
}

function validateWorkflowStep(
  value: unknown,
  pathName: string,
  workflowId: string,
  errors: KnowledgeError[],
): WorkflowStep | null {
  if (!isRecord(value)) {
    errors.push(knowledgeError("INTERNAL_INCONSISTENCY", `${pathName} must be an object.`, pathName, workflowId));
    return null;
  }
  if (!isNonEmptyString(value.command_id) || !isRecord(value.parameter_values) || !(value.note === null || typeof value.note === "string")) {
    errors.push(
      knowledgeError(
        "INTERNAL_INCONSISTENCY",
        `${pathName} must contain command_id, parameter_values, and note.`,
        pathName,
        workflowId,
      ),
    );
    return null;
  }
  return {
    command_id: value.command_id,
    parameter_values: value.parameter_values,
    note: value.note,
  };
}

function validateWorkflow(value: unknown, index: number, errors: KnowledgeError[]): TaskWorkflow | null {
  const pathName = `task_workflows[${index}]`;
  if (!isRecord(value)) {
    errors.push(knowledgeError("INTERNAL_INCONSISTENCY", `${pathName} must be an object.`, pathName));
    return null;
  }
  const workflowId = isNonEmptyString(value.workflow_id) ? value.workflow_id : `index-${index}`;
  const required = [
    "workflow_id",
    "task_id",
    "title",
    "task_category_id",
    "intent_aliases",
    "platform_boundary",
    "prerequisites",
    "phases",
    "expected_results",
    "decision_branches",
    "rollback",
    "source_ids",
    "authorship",
    "validation_status",
  ];
  let valid = true;
  for (const key of required) {
    if (!(key in value)) {
      valid = false;
      errors.push(knowledgeError("INTERNAL_INCONSISTENCY", `${pathName} is missing ${key}.`, pathName, workflowId));
    }
  }
  if (!isNonEmptyString(value.workflow_id) || !isNonEmptyString(value.task_id) || !isNonEmptyString(value.task_category_id)) {
    return null;
  }
  if (value.validation_status !== DOCUMENTED_NOT_DEVICE_TESTED) {
    valid = false;
    errors.push(
      knowledgeError(
        "INTERNAL_INCONSISTENCY",
        `Workflow ${workflowId} validation_status must remain ${DOCUMENTED_NOT_DEVICE_TESTED}.`,
        pathName,
        workflowId,
      ),
    );
  }
  for (const key of ["intent_aliases", "prerequisites", "expected_results", "source_ids"] as const) {
    if (!isStringArray(value[key])) {
      valid = false;
      errors.push(
        knowledgeError("INTERNAL_INCONSISTENCY", `Workflow ${workflowId} field ${key} must be an array of strings.`, pathName, workflowId),
      );
    }
  }
  if (!isNonEmptyString(value.platform_boundary) || !isNonEmptyString(value.authorship) || !isNonEmptyString(value.title)) {
    valid = false;
    errors.push(
      knowledgeError("INTERNAL_INCONSISTENCY", `Workflow ${workflowId} title, platform boundary, or authorship is empty.`, pathName, workflowId),
    );
  }
  if (!isRecord(value.phases)) {
    valid = false;
    errors.push(knowledgeError("INTERNAL_INCONSISTENCY", `Workflow ${workflowId} phases must be an object.`, pathName, workflowId));
  } else {
    const phaseKeys = Object.keys(value.phases).sort();
    const expected = [...PHASE_NAMES].sort();
    if (phaseKeys.length !== expected.length || phaseKeys.some((key, index) => key !== expected[index])) {
      valid = false;
      errors.push(
        knowledgeError(
          "INTERNAL_INCONSISTENCY",
          `Workflow ${workflowId} phases must be exactly ${PHASE_NAMES.join(", ")}.`,
          pathName,
          workflowId,
        ),
      );
    } else {
      for (const phase of PHASE_NAMES) {
        const steps = value.phases[phase];
        if (!Array.isArray(steps)) {
          valid = false;
          errors.push(
            knowledgeError("INTERNAL_INCONSISTENCY", `Workflow ${workflowId} phase ${phase} must be an array.`, pathName, workflowId),
          );
          continue;
        }
        steps.forEach((step, stepIndex) => {
          const parsedStep = validateWorkflowStep(
            step,
            `${pathName}.phases.${phase}[${stepIndex}]`,
            workflowId,
            errors,
          );
          if (!parsedStep) {
            valid = false;
          }
        });
      }
    }
  }
  if (!Array.isArray(value.decision_branches)) {
    valid = false;
    errors.push(
      knowledgeError("INTERNAL_INCONSISTENCY", `Workflow ${workflowId} decision_branches must be an array.`, pathName, workflowId),
    );
  } else {
    value.decision_branches.forEach((branch, branchIndex) => {
      if (!isRecord(branch) || !isNonEmptyString(branch.condition) || !isNonEmptyString(branch.action)) {
        valid = false;
        errors.push(
          knowledgeError(
            "INTERNAL_INCONSISTENCY",
            `Workflow ${workflowId} decision_branches[${branchIndex}] requires condition and action.`,
            pathName,
            workflowId,
          ),
        );
      }
    });
  }
  if (!isRecord(value.rollback) || !isNonEmptyString(value.rollback.strategy) || !isStringArray(value.rollback.instructions)) {
    valid = false;
    errors.push(
      knowledgeError(
        "INTERNAL_INCONSISTENCY",
        `Workflow ${workflowId} rollback requires strategy and instructions.`,
        pathName,
        workflowId,
      ),
    );
  }
  return valid ? (value as unknown as TaskWorkflow) : null;
}

function validateCategory(value: unknown, index: number, errors: KnowledgeError[]): boolean {
  const pathName = `task_categories[${index}]`;
  if (!isRecord(value) || !isNonEmptyString(value.category_id) || !isNonEmptyString(value.label) || !isNonEmptyString(value.type) || !isNonEmptyString(value.coverage_status) || !(value.parent_id === null || typeof value.parent_id === "string")) {
    errors.push(knowledgeError("INTERNAL_INCONSISTENCY", `${pathName} does not match the category record shape.`, pathName));
    return false;
  }
  return true;
}

function validateTask(value: unknown, index: number, errors: KnowledgeError[]): boolean {
  const pathName = `tasks[${index}]`;
  if (!isRecord(value) || !isNonEmptyString(value.task_id) || !isNonEmptyString(value.title) || !isNonEmptyString(value.category_id) || !isNonEmptyString(value.coverage_status) || !isStringArray(value.aliases) || !isStringArray(value.workflow_ids)) {
    errors.push(knowledgeError("INTERNAL_INCONSISTENCY", `${pathName} does not match the task record shape.`, pathName));
    return false;
  }
  return true;
}

function validateFamily(value: unknown, index: number, errors: KnowledgeError[]): boolean {
  const pathName = `command_families[${index}]`;
  if (!isRecord(value) || !isNonEmptyString(value.family_id) || !isNonEmptyString(value.label) || !isNonEmptyString(value.coverage_status) || !isStringArray(value.command_ids) || !isStringArray(value.source_ids)) {
    errors.push(knowledgeError("INTERNAL_INCONSISTENCY", `${pathName} does not match the command family shape.`, pathName));
    return false;
  }
  return true;
}

function validateSource(value: unknown, index: number, errors: KnowledgeError[]): boolean {
  const pathName = `sources[${index}]`;
  if (!isRecord(value)) {
    errors.push(knowledgeError("MISSING_SOURCE_REFERENCE", `${pathName} must be an object.`, pathName));
    return false;
  }
  const requiredStrings = [
    "source_id",
    "title",
    "url",
    "publisher",
    "source_type",
    "platform_boundary",
    "release_boundary",
    "retrieved_at",
    "evidence_ref",
    "review_scope",
  ] as const;
  if (requiredStrings.some((key) => !isNonEmptyString(value[key])) || typeof value.notes !== "string") {
    errors.push(
      knowledgeError(
        "MISSING_SOURCE_REFERENCE",
        `${pathName} is missing source identity, boundary, or provenance fields.`,
        pathName,
        typeof value.source_id === "string" ? value.source_id : undefined,
      ),
    );
    return false;
  }
  return true;
}

function validateRelationship(value: unknown, index: number, errors: KnowledgeError[]): boolean {
  const pathName = `relationships[${index}]`;
  if (!isRecord(value) || !isNonEmptyString(value.from_id) || !isNonEmptyString(value.to_id) || !isNonEmptyString(value.type) || !isNonEmptyString(value.workflow_id)) {
    errors.push(knowledgeError("INTERNAL_INCONSISTENCY", `${pathName} does not match the relationship shape.`, pathName));
    return false;
  }
  return true;
}

function collectionIsSound(items: unknown[], validate: (value: unknown, index: number, errors: KnowledgeError[]) => boolean, errors: KnowledgeError[]): boolean {
  let sound = true;
  items.forEach((item, index) => {
    if (!validate(item, index, errors)) {
      sound = false;
    }
  });
  return sound;
}

function validateCoverageDocument(value: unknown, errors: KnowledgeError[]): CoverageDocument | null {
  if (!isRecord(value)) {
    errors.push(knowledgeError("MALFORMED_COVERAGE", "Coverage document must be an object.", REQUIRED_JSON_FILES.coverage));
    return null;
  }
  const metadata = validateMetadataShape(value.metadata, REQUIRED_JSON_FILES.coverage, errors);
  if (!Array.isArray(value.coverage)) {
    errors.push(knowledgeError("MALFORMED_COVERAGE", "coverage must be an array.", "coverage"));
    return null;
  }
  let coverageValid = true;
  value.coverage.forEach((item, index) => {
    const itemPath = `coverage[${index}]`;
    if (!isRecord(item)) {
      coverageValid = false;
      errors.push(knowledgeError("MALFORMED_COVERAGE", `${itemPath} must be an object.`, itemPath));
      return;
    }
    if (
      !isNonEmptyString(item.category_id) ||
      !isNonEmptyString(item.label) ||
      !isNonEmptyString(item.status) ||
      typeof item.command_count !== "number" ||
      typeof item.workflow_count !== "number" ||
      !isStringArray(item.command_ids)
    ) {
      coverageValid = false;
      errors.push(
        knowledgeError(
          "MALFORMED_COVERAGE",
          `${itemPath} requires category_id, label, status, command_count, workflow_count, and command_ids.`,
          itemPath,
          typeof item.category_id === "string" ? item.category_id : undefined,
        ),
      );
    }
  });
  let gapsValid = true;
  if (!Array.isArray(value.unresolved) || !value.unresolved.every((item) => isNonEmptyString(item))) {
    gapsValid = false;
    errors.push(
      knowledgeError(
        "MALFORMED_KNOWN_GAP",
        "unresolved must be an array of non-empty strings.",
        "unresolved",
      ),
    );
  }
  if (
    !isRecord(value.next_partition) ||
    typeof value.next_partition.priority !== "number" ||
    !isNonEmptyString(value.next_partition.name) ||
    !isNonEmptyStringArray(value.next_partition.acceptance_criteria)
  ) {
    gapsValid = false;
    errors.push(
      knowledgeError(
        "MALFORMED_KNOWN_GAP",
        "next_partition requires priority, name, and acceptance_criteria.",
        "next_partition",
      ),
    );
  }
  if (!metadata || !coverageValid || !gapsValid) {
    return null;
  }
  return value as unknown as CoverageDocument;
}

function validateManifestDocument(value: unknown, errors: KnowledgeError[]): ManifestDocument | null {
  if (!isRecord(value)) {
    errors.push(knowledgeError("INCONSISTENT_MANIFEST", "MANIFEST.json must be an object.", REQUIRED_JSON_FILES.manifest));
    return null;
  }
  const metadata = validateMetadataShape(value.metadata, REQUIRED_JSON_FILES.manifest, errors);
  if (!isRecord(value.validation)) {
    errors.push(knowledgeError("INCONSISTENT_MANIFEST", "MANIFEST.json validation must be an object.", "validation"));
  }
  if (!Array.isArray(value.files)) {
    errors.push(knowledgeError("INCONSISTENT_MANIFEST", "MANIFEST.json files must be an array.", "files"));
    return null;
  }
  let filesValid = true;
  value.files.forEach((entry, index) => {
    if (
      !isRecord(entry) ||
      !isNonEmptyString(entry.filename) ||
      typeof entry.size_bytes !== "number" ||
      !isNonEmptyString(entry.sha256)
    ) {
      filesValid = false;
      errors.push(
        knowledgeError("INCONSISTENT_MANIFEST", `Manifest files[${index}] requires filename, size_bytes, and sha256.`, `files[${index}]`),
      );
    }
  });
  if (!metadata || !isRecord(value.validation) || !filesValid) {
    return null;
  }
  return value as unknown as ManifestDocument;
}

function indexBy<T>(items: T[], idOf: (item: T) => string, label: string, pathName: string, errors: KnowledgeError[]): Map<string, T> | null {
  const ids = items.map(idOf);
  const duplicates = duplicateIds(ids, label, pathName);
  errors.push(...duplicates);
  if (duplicates.length > 0) {
    return null;
  }
  return new Map(items.map((item) => [idOf(item), item]));
}

function validateParameterBindings(
  workflow: TaskWorkflow,
  commandsById: Map<string, CommandRecord>,
  errors: KnowledgeError[],
): void {
  for (const phase of PHASE_NAMES) {
    workflow.phases[phase].forEach((step, index) => {
      const command = commandsById.get(step.command_id);
      if (!command) {
        return;
      }
      const elementNames = new Set(command.syntax_elements.map((element) => element.name));
      const required = new Set(
        command.syntax_elements.filter((element) => element.required).map((element) => element.name),
      );
      const provided = Object.keys(step.parameter_values);
      const extra = provided.filter((name) => !elementNames.has(name));
      const missing = [...required].filter((name) => !(name in step.parameter_values));
      if (extra.length > 0 || missing.length > 0) {
        errors.push(
          knowledgeError(
            "INVALID_TEMPLATE_METADATA",
            `Workflow ${workflow.workflow_id} ${phase}[${index}] command ${step.command_id} parameter binding is unresolved. Missing required [${missing.join(", ")}]. Unknown [${extra.join(", ")}].`,
            `task_workflows.${workflow.workflow_id}.phases.${phase}[${index}]`,
            step.command_id,
          ),
        );
      }
    });
  }
}

function relationshipKey(workflowId: string, type: string, fromId: string, toId: string): string {
  return `${workflowId}\u0000${type}\u0000${fromId}\u0000${toId}`;
}

export function validateKnowledgeIntegrity(
  documents: IntegrityDocuments,
  parsed: ReadKnowledgePackage,
): KnowledgeError[] {
  const errors: KnowledgeError[] = [];
  const { dataset, taxonomy, workflows, sourceIndex, coverage, manifest, schema } = documents;

  for (const key of DATASET_ROOT_KEYS) {
    if (!(key in dataset)) {
      errors.push(knowledgeError("SCHEMA_MISMATCH", `Dataset is missing root key ${key}.`, key));
    }
  }

  if (!deepEqual(dataset.metadata, taxonomy.metadata) || !deepEqual(dataset.metadata, workflows.metadata) || !deepEqual(dataset.metadata, sourceIndex.metadata) || !deepEqual(dataset.metadata, coverage.metadata) || !deepEqual(dataset.metadata, manifest.metadata)) {
    errors.push(
      knowledgeError(
        "INCONSISTENT_MANIFEST",
        "metadata objects differ across the dataset, projections, coverage file, or manifest.",
        "metadata",
      ),
    );
  }

  if (typeof schema.$id === "string" && !schema.$id.endsWith(`:${dataset.metadata.schema_version}`)) {
    errors.push(
      knowledgeError(
        "INCONSISTENT_MANIFEST",
        `Schema $id ${schema.$id} does not end with schema_version ${dataset.metadata.schema_version}.`,
        "$id",
      ),
    );
  }

  for (const [countField, collection] of METADATA_COUNT_FIELDS) {
    if (dataset.metadata[countField] !== dataset[collection].length) {
      errors.push(
        knowledgeError(
          "INCONSISTENT_MANIFEST",
          `metadata.${countField} is ${dataset.metadata[countField]} but ${collection} contains ${dataset[collection].length}.`,
          countField,
        ),
      );
    }
  }
  const featureGroups = dataset.task_categories.filter((category) => category.type === "feature_task_group");
  if (dataset.metadata.taxonomy_feature_group_count !== featureGroups.length) {
    errors.push(
      knowledgeError(
        "INCONSISTENT_MANIFEST",
        `metadata.taxonomy_feature_group_count is ${dataset.metadata.taxonomy_feature_group_count} but feature_task_group records are ${featureGroups.length}.`,
        "taxonomy_feature_group_count",
      ),
    );
  }

  const categories = indexBy(dataset.task_categories, (item) => item.category_id, "category_id", "task_categories", errors);
  const tasks = indexBy(dataset.tasks, (item) => item.task_id, "task_id", "tasks", errors);
  const families = indexBy(dataset.command_families, (item) => item.family_id, "family_id", "command_families", errors);
  const commands = indexBy(dataset.commands, (item) => item.command_id, "command_id", "commands", errors);
  const workflowIndex = indexBy(dataset.task_workflows, (item) => item.workflow_id, "workflow_id", "task_workflows", errors);
  const sources = indexBy(dataset.sources, (item) => item.source_id, "source_id", "sources", errors);
  const coverageIndex = indexBy(coverage.coverage, (item) => item.category_id, "coverage category_id", "coverage", errors);

  if (!categories || !tasks || !families || !commands || !workflowIndex || !sources || !coverageIndex) {
    return errors;
  }

  for (const category of dataset.task_categories) {
    if (!CATEGORY_TYPES.includes(category.type as (typeof CATEGORY_TYPES)[number])) {
      errors.push(
        knowledgeError(
          "INTERNAL_INCONSISTENCY",
          `Category ${category.category_id} type ${category.type} is not task_partition or feature_task_group.`,
          "task_categories",
          category.category_id,
        ),
      );
      continue;
    }
    if (category.type === "task_partition") {
      if (category.parent_id !== null || category.coverage_status !== PARTITION_COVERAGE_STATUS) {
        errors.push(
          knowledgeError(
            "INTERNAL_INCONSISTENCY",
            `Task partition ${category.category_id} must have a null parent and coverage_status ${PARTITION_COVERAGE_STATUS}.`,
            "task_categories",
            category.category_id,
          ),
        );
      }
    } else {
      if (!isNonEmptyString(category.parent_id) || !categories.has(category.parent_id)) {
        errors.push(
          knowledgeError(
            "UNRESOLVED_REFERENCE",
            `Feature group ${category.category_id} parent_id ${String(category.parent_id)} does not resolve.`,
            "task_categories",
            category.category_id,
          ),
        );
      }
      if (!FEATURE_COVERAGE_STATUSES.includes(category.coverage_status as (typeof FEATURE_COVERAGE_STATUSES)[number])) {
        errors.push(
          knowledgeError(
            "INTERNAL_INCONSISTENCY",
            `Feature group ${category.category_id} coverage_status ${category.coverage_status} is not seed_partial or backlog.`,
            "task_categories",
            category.category_id,
          ),
        );
      }
    }
  }

  for (const task of dataset.tasks) {
    if (!categories.has(task.category_id)) {
      errors.push(
        knowledgeError("UNRESOLVED_REFERENCE", `Task ${task.task_id} category ${task.category_id} does not resolve.`, "tasks", task.task_id),
      );
    }
    const hasWorkflow = task.workflow_ids.length > 0;
    if (hasWorkflow && task.coverage_status !== TASK_COVERAGE_WITH_WORKFLOW) {
      errors.push(
        knowledgeError(
          "INTERNAL_INCONSISTENCY",
          `Task ${task.task_id} has workflows but coverage_status is ${task.coverage_status}.`,
          "tasks",
          task.task_id,
        ),
      );
    }
    if (!hasWorkflow && task.coverage_status !== TASK_COVERAGE_WITHOUT_WORKFLOW) {
      errors.push(
        knowledgeError(
          "INTERNAL_INCONSISTENCY",
          `Task ${task.task_id} has no workflow but coverage_status is ${task.coverage_status}.`,
          "tasks",
          task.task_id,
        ),
      );
    }
    for (const workflowId of task.workflow_ids) {
      if (!workflowIndex.has(workflowId)) {
        errors.push(
          knowledgeError(
            "MISSING_REFERENCED_WORKFLOW",
            `Task ${task.task_id} references missing workflow ${workflowId}.`,
            "tasks.workflow_ids",
            task.task_id,
          ),
        );
      }
    }
  }

  for (const sourceId of dataset.sources.map((source) => source.source_id)) {
    if (!isNonEmptyString(sourceId)) {
      errors.push(knowledgeError("MISSING_SOURCE_REFERENCE", "A source record has an empty source_id.", "sources"));
    }
  }

  for (const command of dataset.commands) {
    if (!families.has(command.canonical_family)) {
      errors.push(
        knowledgeError(
          "UNRESOLVED_REFERENCE",
          `Command ${command.command_id} canonical_family ${command.canonical_family} does not resolve.`,
          "commands.canonical_family",
          command.command_id,
        ),
      );
    }
    if (!categories.has(command.task_category_id)) {
      errors.push(
        knowledgeError(
          "UNRESOLVED_REFERENCE",
          `Command ${command.command_id} task_category_id ${command.task_category_id} does not resolve.`,
          "commands.task_category_id",
          command.command_id,
        ),
      );
    }
    for (const taskId of command.task_ids) {
      if (!tasks.has(taskId)) {
        errors.push(
          knowledgeError(
            "MISSING_REFERENCED_TASK",
            `Command ${command.command_id} references missing task ${taskId}.`,
            "commands.task_ids",
            command.command_id,
          ),
        );
      }
    }
    for (const field of ["verification_command_ids", "troubleshooting_command_ids", "related_command_ids"] as const) {
      for (const commandId of command[field]) {
        if (!commands.has(commandId)) {
          errors.push(
            knowledgeError(
              "MISSING_REFERENCED_COMMAND",
              `Command ${command.command_id} ${field} references missing command ${commandId}.`,
              `commands.${field}`,
              command.command_id,
            ),
          );
        }
      }
    }
    if (command.source_ids.length === 0) {
      errors.push(
        knowledgeError(
          "MISSING_SOURCE_REFERENCE",
          `Command ${command.command_id} has no source_ids.`,
          "commands.source_ids",
          command.command_id,
        ),
      );
    }
    const evidenceIds = new Set(command.source_evidence.map((evidence) => evidence.source_id));
    for (const sourceId of command.source_ids) {
      if (!sources.has(sourceId)) {
        errors.push(
          knowledgeError(
            "MISSING_SOURCE_REFERENCE",
            `Command ${command.command_id} source_id ${sourceId} does not resolve.`,
            "commands.source_ids",
            command.command_id,
          ),
        );
      }
      if (!evidenceIds.has(sourceId)) {
        errors.push(
          knowledgeError(
            "MISSING_SOURCE_REFERENCE",
            `Command ${command.command_id} source_id ${sourceId} has no source_evidence section.`,
            "commands.source_evidence",
            command.command_id,
          ),
        );
      }
    }
    for (const evidence of command.source_evidence) {
      if (!command.source_ids.includes(evidence.source_id) || !sources.has(evidence.source_id)) {
        errors.push(
          knowledgeError(
            "MISSING_SOURCE_REFERENCE",
            `Command ${command.command_id} source_evidence ${evidence.source_id} is not a resolved source_id.`,
            "commands.source_evidence",
            command.command_id,
          ),
        );
      }
    }
  }

  for (const family of dataset.command_families) {
    for (const commandId of family.command_ids) {
      if (!commands.has(commandId)) {
        errors.push(
          knowledgeError(
            "MISSING_REFERENCED_COMMAND",
            `Family ${family.family_id} references missing command ${commandId}.`,
            "command_families.command_ids",
            family.family_id,
          ),
        );
      }
    }
    for (const sourceId of family.source_ids) {
      if (!sources.has(sourceId)) {
        errors.push(
          knowledgeError(
            "MISSING_SOURCE_REFERENCE",
            `Family ${family.family_id} source_id ${sourceId} does not resolve.`,
            "command_families.source_ids",
            family.family_id,
          ),
        );
      }
    }
    const byCanonical = dataset.commands
      .filter((command) => command.canonical_family === family.family_id)
      .map((command) => command.command_id)
      .sort();
    const listed = [...family.command_ids].sort();
    if (!deepEqual(byCanonical, listed)) {
      errors.push(
        knowledgeError(
          "INTERNAL_INCONSISTENCY",
          `Family ${family.family_id} command_ids do not match commands with that canonical_family.`,
          "command_families",
          family.family_id,
        ),
      );
    }
  }

  for (const workflow of dataset.task_workflows) {
    if (!tasks.has(workflow.task_id)) {
      errors.push(
        knowledgeError(
          "MISSING_REFERENCED_TASK",
          `Workflow ${workflow.workflow_id} references missing task ${workflow.task_id}.`,
          "task_workflows.task_id",
          workflow.workflow_id,
        ),
      );
    } else if (!tasks.get(workflow.task_id)?.workflow_ids.includes(workflow.workflow_id)) {
      errors.push(
        knowledgeError(
          "INTERNAL_INCONSISTENCY",
          `Workflow ${workflow.workflow_id} is not listed on task ${workflow.task_id}.`,
          "task_workflows.task_id",
          workflow.workflow_id,
        ),
      );
    }
    const task = tasks.get(workflow.task_id);
    if (task && workflow.task_category_id !== task.category_id) {
      errors.push(
        knowledgeError(
          "INTERNAL_INCONSISTENCY",
          `Workflow ${workflow.workflow_id} category ${workflow.task_category_id} does not match task category ${task.category_id}.`,
          "task_workflows.task_category_id",
          workflow.workflow_id,
        ),
      );
    }
    if (!categories.has(workflow.task_category_id)) {
      errors.push(
        knowledgeError(
          "UNRESOLVED_REFERENCE",
          `Workflow ${workflow.workflow_id} category ${workflow.task_category_id} does not resolve.`,
          "task_workflows.task_category_id",
          workflow.workflow_id,
        ),
      );
    }
    for (const sourceId of workflow.source_ids) {
      if (!sources.has(sourceId)) {
        errors.push(
          knowledgeError(
            "MISSING_SOURCE_REFERENCE",
            `Workflow ${workflow.workflow_id} source_id ${sourceId} does not resolve.`,
            "task_workflows.source_ids",
            workflow.workflow_id,
          ),
        );
      }
    }
    for (const phase of PHASE_NAMES) {
      for (const step of workflow.phases[phase]) {
        if (!commands.has(step.command_id)) {
          errors.push(
            knowledgeError(
              "MISSING_REFERENCED_COMMAND",
              `Workflow ${workflow.workflow_id} phase ${phase} references missing command ${step.command_id}.`,
              `task_workflows.phases.${phase}`,
              workflow.workflow_id,
            ),
          );
        }
      }
    }
    validateParameterBindings(workflow, commands, errors);
  }

  const phaseEdges = new Set<string>();
  for (const workflow of dataset.task_workflows) {
    for (const phase of PHASE_NAMES) {
      for (const step of workflow.phases[phase]) {
        phaseEdges.add(
          relationshipKey(workflow.workflow_id, PHASE_RELATIONSHIP_TYPE[phase], workflow.task_id, step.command_id),
        );
      }
    }
  }
  const relationEdges = new Set<string>();
  for (const relation of dataset.relationships) {
    if (!RELATIONSHIP_TYPES.includes(relation.type as (typeof RELATIONSHIP_TYPES)[number])) {
      errors.push(
        knowledgeError(
          "INTERNAL_INCONSISTENCY",
          `Relationship type ${relation.type} is not a workflow phase use.`,
          "relationships",
          relation.workflow_id,
        ),
      );
    }
    if (!tasks.has(relation.from_id)) {
      errors.push(
        knowledgeError(
          "MISSING_REFERENCED_TASK",
          `Relationship from_id ${relation.from_id} does not resolve to a task.`,
          "relationships.from_id",
          relation.from_id,
        ),
      );
    }
    if (!commands.has(relation.to_id)) {
      errors.push(
        knowledgeError(
          "MISSING_REFERENCED_COMMAND",
          `Relationship to_id ${relation.to_id} does not resolve to a command.`,
          "relationships.to_id",
          relation.to_id,
        ),
      );
    }
    if (!workflowIndex.has(relation.workflow_id)) {
      errors.push(
        knowledgeError(
          "MISSING_REFERENCED_WORKFLOW",
          `Relationship workflow_id ${relation.workflow_id} does not resolve.`,
          "relationships.workflow_id",
          relation.workflow_id,
        ),
      );
    }
    const workflow = workflowIndex.get(relation.workflow_id);
    if (workflow && relation.from_id !== workflow.task_id) {
      errors.push(
        knowledgeError(
          "INTERNAL_INCONSISTENCY",
          `Relationship in ${relation.workflow_id} from_id ${relation.from_id} does not match workflow task ${workflow.task_id}.`,
          "relationships.from_id",
          relation.workflow_id,
        ),
      );
    }
    const key = relationshipKey(relation.workflow_id, relation.type, relation.from_id, relation.to_id);
    if (relationEdges.has(key)) {
      errors.push(
        knowledgeError(
          "INTERNAL_INCONSISTENCY",
          `Duplicate relationship ${relation.type} ${relation.from_id} -> ${relation.to_id} in ${relation.workflow_id}.`,
          "relationships",
          relation.workflow_id,
        ),
      );
    }
    relationEdges.add(key);
  }
  for (const edge of phaseEdges) {
    if (!relationEdges.has(edge)) {
      errors.push(
        knowledgeError(
          "INTERNAL_INCONSISTENCY",
          "A workflow phase step has no matching relationship edge.",
          "relationships",
          edge.split("\u0000")[0],
        ),
      );
    }
  }
  for (const edge of relationEdges) {
    if (!phaseEdges.has(edge)) {
      errors.push(
        knowledgeError(
          "INTERNAL_INCONSISTENCY",
          "A relationship edge does not match any workflow phase step.",
          "relationships",
          edge.split("\u0000")[0],
        ),
      );
    }
  }

  const commandsByCategory = new Map<string, string[]>();
  for (const command of dataset.commands) {
    const list = commandsByCategory.get(command.task_category_id) ?? [];
    list.push(command.command_id);
    commandsByCategory.set(command.task_category_id, list);
  }
  const featureIds = new Set(featureGroups.map((category) => category.category_id));
  if (coverage.coverage.length !== featureIds.size || coverage.coverage.some((item) => !featureIds.has(item.category_id))) {
    errors.push(
      knowledgeError(
        "MALFORMED_COVERAGE",
        "Coverage entries must correspond one-to-one with feature_task_group categories.",
        "coverage",
      ),
    );
  }
  for (const item of coverage.coverage) {
    const category = categories.get(item.category_id);
    if (!category) {
      errors.push(
        knowledgeError(
          "UNRESOLVED_REFERENCE",
          `Coverage category ${item.category_id} does not resolve.`,
          "coverage.category_id",
          item.category_id,
        ),
      );
      continue;
    }
    if (item.label !== category.label || item.status !== category.coverage_status) {
      errors.push(
        knowledgeError(
          "MALFORMED_COVERAGE",
          `Coverage ${item.category_id} label or status does not match the task category.`,
          "coverage",
          item.category_id,
        ),
      );
    }
    if (item.command_count !== item.command_ids.length) {
      errors.push(
        knowledgeError(
          "MALFORMED_COVERAGE",
          `Coverage ${item.category_id} command_count does not match command_ids.`,
          "coverage.command_count",
          item.category_id,
        ),
      );
    }
    const actualWorkflows = dataset.task_workflows.filter((workflow) => workflow.task_category_id === item.category_id).length;
    if (item.workflow_count !== actualWorkflows) {
      errors.push(
        knowledgeError(
          "MALFORMED_COVERAGE",
          `Coverage ${item.category_id} workflow_count is ${item.workflow_count} but ${actualWorkflows} workflows use that category.`,
          "coverage.workflow_count",
          item.category_id,
        ),
      );
    }
    const actualCommands = (commandsByCategory.get(item.category_id) ?? []).slice().sort();
    const statedCommands = item.command_ids.slice().sort();
    if (!deepEqual(actualCommands, statedCommands)) {
      errors.push(
        knowledgeError(
          "MALFORMED_COVERAGE",
          `Coverage ${item.category_id} command_ids do not match commands with that task_category_id.`,
          "coverage.command_ids",
          item.category_id,
        ),
      );
    }
    for (const commandId of item.command_ids) {
      if (!commands.has(commandId)) {
        errors.push(
          knowledgeError(
            "MISSING_REFERENCED_COMMAND",
            `Coverage ${item.category_id} references missing command ${commandId}.`,
            "coverage.command_ids",
            item.category_id,
          ),
        );
      }
    }
  }

  if (!isRecord(dataset.platform_version_metadata)) {
    errors.push(
      knowledgeError("INTERNAL_INCONSISTENCY", "platform_version_metadata must be an object.", "platform_version_metadata"),
    );
  } else {
    const platform = dataset.platform_version_metadata;
    const boundary = platform.primary_boundary;
    if (
      !isRecord(boundary) ||
      !isNonEmptyString(boundary.platform) ||
      !isNonEmptyString(boundary.software) ||
      !isNonEmptyString(boundary.release) ||
      !isStringArray(platform.excluded_software) ||
      !isNonEmptyString(platform.selection_rule) ||
      !isNonEmptyString(platform.null_policy)
    ) {
      errors.push(
        knowledgeError(
          "INTERNAL_INCONSISTENCY",
          "platform_version_metadata primary_boundary, excluded_software, selection_rule, or null_policy is malformed.",
          "platform_version_metadata",
        ),
      );
    }
  }

  if (!deepEqual(dataset.task_categories, taxonomy.task_categories) || !deepEqual(dataset.tasks, taxonomy.tasks)) {
    errors.push(
      knowledgeError(
        "INTERNAL_INCONSISTENCY",
        "Cisco_Task_Intent_Taxonomy.json is not an exact projection of the dataset categories and tasks.",
        REQUIRED_JSON_FILES.taxonomy,
      ),
    );
  }
  if (!deepEqual(dataset.task_workflows, workflows.task_workflows) || !deepEqual(dataset.relationships, workflows.relationships)) {
    errors.push(
      knowledgeError(
        "INTERNAL_INCONSISTENCY",
        "Cisco_Task_Workflows.json is not an exact projection of the dataset workflows and relationships.",
        REQUIRED_JSON_FILES.workflows,
      ),
    );
  }
  if (!deepEqual(dataset.sources, sourceIndex.sources)) {
    errors.push(
      knowledgeError(
        "INTERNAL_INCONSISTENCY",
        "Cisco_Source_Index.json is not an exact projection of the dataset sources.",
        REQUIRED_JSON_FILES.sources,
      ),
    );
  }

  const listed = new Set<string>();
  for (const entry of manifest.files) {
    if (listed.has(entry.filename)) {
      errors.push(
        knowledgeError("INCONSISTENT_MANIFEST", `Manifest lists ${entry.filename} more than once.`, "files", entry.filename),
      );
    }
    listed.add(entry.filename);
    if (!/^[a-f0-9]{64}$/.test(entry.sha256)) {
      errors.push(
        knowledgeError("INCONSISTENT_MANIFEST", `Manifest sha256 for ${entry.filename} is not 64 lowercase hex characters.`, "files", entry.filename),
      );
    }
    const file = bytesForFilename(parsed, entry.filename);
    if (!file) {
      continue;
    }
    if (file.sizeBytes !== entry.size_bytes || file.sha256 !== entry.sha256) {
      errors.push(
        knowledgeError(
          "INCONSISTENT_MANIFEST",
          `Manifest size or sha256 does not match ${entry.filename}.`,
          entry.filename,
          entry.filename,
        ),
      );
    }
  }
  for (const filename of Object.values(REQUIRED_JSON_FILES)) {
    if (filename === REQUIRED_JSON_FILES.manifest) {
      continue;
    }
    if (!listed.has(filename)) {
      errors.push(
        knowledgeError("INCONSISTENT_MANIFEST", `Manifest does not list required file ${filename}.`, filename),
      );
    }
  }

  return errors;
}

export function structuralDocuments(
  parsed: ReadKnowledgePackage,
): { documents: IntegrityDocuments | null; errors: KnowledgeError[] } {
  const errors: KnowledgeError[] = [];
  const datasetValue = parsed.jsonFiles.get(REQUIRED_JSON_FILES.dataset)?.value;
  const taxonomyValue = parsed.jsonFiles.get(REQUIRED_JSON_FILES.taxonomy)?.value;
  const workflowsValue = parsed.jsonFiles.get(REQUIRED_JSON_FILES.workflows)?.value;
  const sourcesValue = parsed.jsonFiles.get(REQUIRED_JSON_FILES.sources)?.value;
  const coverageValue = parsed.jsonFiles.get(REQUIRED_JSON_FILES.coverage)?.value;
  const manifestValue = parsed.jsonFiles.get(REQUIRED_JSON_FILES.manifest)?.value;
  const schemaValue = parsed.jsonFiles.get(REQUIRED_JSON_FILES.schema)?.value;

  if (!isRecord(datasetValue)) {
    errors.push(knowledgeError("SCHEMA_MISMATCH", "Dataset root must be an object.", REQUIRED_JSON_FILES.dataset));
    return { documents: null, errors };
  }
  const metadata = validateMetadataShape(datasetValue.metadata, REQUIRED_JSON_FILES.dataset, errors);
  const collections = {
    task_categories: datasetValue.task_categories,
    tasks: datasetValue.tasks,
    command_families: datasetValue.command_families,
    commands: datasetValue.commands,
    task_workflows: datasetValue.task_workflows,
    relationships: datasetValue.relationships,
    sources: datasetValue.sources,
  };
  for (const [key, value] of Object.entries(collections)) {
    if (!Array.isArray(value)) {
      errors.push(knowledgeError("SCHEMA_MISMATCH", `Dataset ${key} must be an array.`, key));
    }
  }
  if (!metadata || Object.values(collections).some((value) => !Array.isArray(value))) {
    return { documents: null, errors };
  }

  const commands: CommandRecord[] = [];
  const commandItems = datasetValue.commands as unknown[];
  commandItems.forEach((command, index) => {
    const parsedCommand = validateCommandRecord(command, index, errors);
    if (parsedCommand) {
      commands.push(parsedCommand);
    }
  });
  const taskWorkflows: TaskWorkflow[] = [];
  const workflowItems = datasetValue.task_workflows as unknown[];
  workflowItems.forEach((workflow, index) => {
    const parsedWorkflow = validateWorkflow(workflow, index, errors);
    if (parsedWorkflow) {
      taskWorkflows.push(parsedWorkflow);
    }
  });
  const categoriesSound = collectionIsSound(datasetValue.task_categories as unknown[], validateCategory, errors);
  const tasksSound = collectionIsSound(datasetValue.tasks as unknown[], validateTask, errors);
  const familiesSound = collectionIsSound(datasetValue.command_families as unknown[], validateFamily, errors);
  const sourcesSound = collectionIsSound(datasetValue.sources as unknown[], validateSource, errors);
  const relationshipsSound = collectionIsSound(datasetValue.relationships as unknown[], validateRelationship, errors);

  if (!isRecord(taxonomyValue) || !isRecord(workflowsValue) || !isRecord(sourcesValue)) {
    errors.push(knowledgeError("INTERNAL_INCONSISTENCY", "A projection file root is not an object.", "projections"));
    return { documents: null, errors };
  }
  const coverage = validateCoverageDocument(coverageValue, errors);
  const manifest = validateManifestDocument(manifestValue, errors);
  if (!isRecord(schemaValue)) {
    errors.push(knowledgeError("SCHEMA_MISMATCH", "Schema root must be an object.", REQUIRED_JSON_FILES.schema));
  }
  if (!coverage || !manifest || !isRecord(schemaValue)) {
    return { documents: null, errors };
  }
  if (
    commands.length !== commandItems.length ||
    taskWorkflows.length !== workflowItems.length ||
    !categoriesSound ||
    !tasksSound ||
    !familiesSound ||
    !sourcesSound ||
    !relationshipsSound
  ) {
    return { documents: null, errors };
  }

  const dataset = {
    ...(datasetValue as unknown as DatasetDocument),
    metadata,
    commands,
    task_workflows: taskWorkflows,
  };

  return {
    documents: {
      dataset,
      taxonomy: taxonomyValue as unknown as TaxonomyDocument,
      workflows: workflowsValue as unknown as WorkflowsDocument,
      sourceIndex: sourcesValue as unknown as SourceIndexDocument,
      coverage,
      manifest,
      schema: schemaValue as SchemaDocument,
    },
    errors,
  };
}
