import type { ValidationView } from "./types";

export function validationMessage(validation: ValidationView): string {
  if (validation.state === "NEEDS_INPUT") {
    const missing = validation.missing.map((item) => item.inputKey).join(", ");
    return `NEEDS_INPUT. Required values are missing: ${missing}.`;
  }
  if (validation.state === "INVALID_INPUT") {
    const details = validation.invalid.map((item) => item.message).join(" ");
    return `INVALID_INPUT. ${details}`;
  }
  if (validation.state === "CONFLICT") {
    const details = validation.conflicts.map((item) => item.message).join(" ");
    return `CONFLICT. ${details}`;
  }
  if (validation.state === "UNSUPPORTED_VALIDATION") {
    return "UNSUPPORTED_VALIDATION. A procedure is not established for this task.";
  }
  if (validation.state === "DATA_ERROR") {
    return "DATA_ERROR. The portal cannot generate a procedure from the loaded knowledge.";
  }
  return "READY. The governed procedure can be generated. This does not authorize commands on a live device.";
}
