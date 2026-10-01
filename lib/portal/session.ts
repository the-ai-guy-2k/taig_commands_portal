import type { FormSession, FormStatus, ProcedureRun } from "./types";

export function emptyFormSession(): FormSession {
  return { taskId: null, generationId: 0, values: {}, status: "FORM_READY", result: null };
}

export function selectTask(session: FormSession, taskId: string): FormSession {
  if (session.taskId === taskId) {
    return session;
  }
  return {
    taskId,
    generationId: session.generationId + 1,
    values: {},
    status: "FORM_READY",
    result: null,
  };
}

export function changeInput(session: FormSession, inputKey: string, value: string): FormSession {
  if (session.values[inputKey] === value) {
    return session;
  }
  return {
    ...session,
    generationId: session.generationId + 1,
    values: { ...session.values, [inputKey]: value },
    status: "FORM_READY",
    result: null,
  };
}

export function beginGeneration(session: FormSession): { session: FormSession; generationId: number } {
  const generationId = session.generationId + 1;
  return {
    generationId,
    session: { ...session, generationId, status: "GENERATING", result: null },
  };
}

export function applyRun(session: FormSession, run: ProcedureRun, generationId: number): FormSession {
  if (session.generationId !== generationId) {
    return session;
  }
  return { ...session, status: statusFor(run), result: run };
}

function statusFor(run: ProcedureRun): FormStatus {
  if (run.kind === "GENERATED") {
    return "GENERATED";
  }
  if (run.kind === "VALIDATION") {
    return run.validation.state;
  }
  if (run.kind === "DATA_ERROR") {
    return "DATA_ERROR";
  }
  return "UPSTREAM_ERROR";
}
