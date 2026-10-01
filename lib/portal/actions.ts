"use server";

import { runTaskProcedure } from "./run";
import type { ProcedureRun } from "./types";

export async function generateTaskProcedure(taskId: string, values: Record<string, string>): Promise<ProcedureRun> {
  return runTaskProcedure(taskId, values);
}
