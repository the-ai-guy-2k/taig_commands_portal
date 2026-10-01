import type { InputDiscoveryResult } from "../inputs/types";
import type { LoadedKnowledge } from "../knowledge/types";
import { isCredentialName } from "../rendering";
import { discoverTaskInputContract } from "../inputs";
import type { TaskCatalog } from "../tasks/types";
import type { TaskFormView } from "./types";

export function buildFormCatalog(
  knowledge: LoadedKnowledge,
  catalog: TaskCatalog,
): Record<string, TaskFormView> {
  const forms: Record<string, TaskFormView> = {};
  for (const task of catalog.tasks) {
    if (task.workflowAvailability !== "present") {
      continue;
    }
    forms[task.taskId] = { ...toFormView(discoverTaskInputContract(knowledge, task)), taskId: task.taskId };
  }
  return forms;
}

function toFormView(discovery: InputDiscoveryResult): TaskFormView {
  if (!discovery.ok) {
    if (discovery.state === "DATA_ERROR") {
      return {
        taskId: discovery.errors[0]?.taskId ?? "",
        state: "DATA_ERROR",
        fields: [],
        errors: discovery.errors.map((error) => ({ code: error.code, message: error.message })),
        deviceExecutionAuthorized: false,
      };
    }
    return {
      taskId: discovery.taskId,
      state: "UNSUPPORTED_VALIDATION",
      fields: [],
      errors: [{ code: discovery.state, message: discovery.reason }],
      deviceExecutionAuthorized: false,
    };
  }

  const credential = discovery.contract.inputs.find(
    (input) => isCredentialName(input.inputKey) || isCredentialName(input.parameterName),
  );
  if (credential) {
    return {
      taskId: discovery.contract.taskId,
      state: "UNSUPPORTED_VALIDATION",
      fields: [],
      errors: [
        {
          code: "CREDENTIAL_INPUT",
          message: `Input ${credential.inputKey} is credential material and is not collected.`,
        },
      ],
      deviceExecutionAuthorized: false,
    };
  }

  return {
    taskId: discovery.contract.taskId,
    state: "FORM",
    fields: discovery.contract.inputs.map((input) => ({
      inputKey: input.inputKey,
      parameterName: input.parameterName,
      requirement: input.requirement,
      description: input.description,
      exampleValue: String(input.exampleValue),
      range: input.range,
    })),
    errors: [],
    deviceExecutionAuthorized: false,
  };
}
