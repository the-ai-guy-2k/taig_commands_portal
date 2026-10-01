import Ajv2020 from "ajv/dist/2020";
import { knowledgeError, type KnowledgeError } from "./errors";
import { isRecord } from "./guards";

export function validateDatasetAgainstSchema(
  schema: unknown,
  dataset: unknown,
): KnowledgeError[] {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
  });
  if (!isRecord(schema)) {
    return [
      knowledgeError(
        "SCHEMA_MISMATCH",
        "Cisco_Command_Dataset.schema.json must be a JSON object.",
        "Cisco_Command_Dataset.schema.json",
      ),
    ];
  }

  let validate: ReturnType<typeof ajv.compile>;
  try {
    validate = ajv.compile(schema);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Schema compilation failed.";
    return [
      knowledgeError(
        "SCHEMA_MISMATCH",
        `Cisco command dataset schema could not be compiled: ${detail}`,
        "Cisco_Command_Dataset.schema.json",
      ),
    ];
  }

  if (validate(dataset)) {
    return [];
  }

  return (validate.errors ?? []).map((error) => {
    const location = error.instancePath && error.instancePath.length > 0 ? error.instancePath : "/";
    return knowledgeError(
      "SCHEMA_MISMATCH",
      `${location} ${error.message ?? "schema validation failed"}`,
      location,
    );
  });
}
