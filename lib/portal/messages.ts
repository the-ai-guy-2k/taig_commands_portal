import { presentValidation } from "../coverage/present";
import type { ValidationView } from "./types";

export function validationMessage(validation: ValidationView): string {
  const notice = presentValidation(validation);
  return `${notice.backendState}. ${notice.headline}. ${notice.explanation}`;
}
