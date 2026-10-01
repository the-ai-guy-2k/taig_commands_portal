import { PHASE_NAMES, PHASE_RELATIONSHIP_TYPE } from "./constants";
import { knowledgeError, type KnowledgeError } from "./errors";
import type { CommandRecord, LoadedKnowledge, SourceRecord, TaskTrace, TraceStep } from "./types";

export type TraceResult =
  | { ok: true; trace: TaskTrace }
  | { ok: false; error: KnowledgeError };

function commandsFor(knowledge: LoadedKnowledge, commandIds: readonly string[], field: string, ownerId: string): CommandRecord[] | KnowledgeError {
  const resolved: CommandRecord[] = [];
  for (const commandId of commandIds) {
    const command = knowledge.indexes.commandsById.get(commandId);
    if (!command) {
      return knowledgeError(
        "MISSING_REFERENCED_COMMAND",
        `${ownerId} ${field} references missing command ${commandId}.`,
        field,
        ownerId,
      );
    }
    resolved.push(command);
  }
  return resolved;
}

function sourcesFor(knowledge: LoadedKnowledge, command: CommandRecord): SourceRecord[] | KnowledgeError {
  const resolved: SourceRecord[] = [];
  for (const sourceId of command.source_ids) {
    const source = knowledge.indexes.sourcesById.get(sourceId);
    if (!source) {
      return knowledgeError(
        "MISSING_SOURCE_REFERENCE",
        `Command ${command.command_id} source ${sourceId} does not resolve.`,
        "commands.source_ids",
        command.command_id,
      );
    }
    resolved.push(source);
  }
  return resolved;
}

export function traceTask(knowledge: LoadedKnowledge, taskId: string): TraceResult {
  const task = knowledge.indexes.tasksById.get(taskId);
  if (!task) {
    return {
      ok: false,
      error: knowledgeError(
        "UNRESOLVED_REFERENCE",
        `No task with exact task_id ${taskId} is loaded. Alias lookup is not part of this capability.`,
        "tasks.task_id",
        taskId,
      ),
    };
  }

  const category = knowledge.indexes.categoriesById.get(task.category_id);
  if (!category) {
    return {
      ok: false,
      error: knowledgeError(
        "UNRESOLVED_REFERENCE",
        `Task ${taskId} category ${task.category_id} does not resolve.`,
        "tasks.category_id",
        taskId,
      ),
    };
  }

  const workflows: TaskTrace["workflows"] = [];
  for (const workflowId of task.workflow_ids) {
    const workflow = knowledge.indexes.workflowsById.get(workflowId);
    if (!workflow) {
      return {
        ok: false,
        error: knowledgeError(
          "MISSING_REFERENCED_WORKFLOW",
          `Task ${taskId} references missing workflow ${workflowId}.`,
          "tasks.workflow_ids",
          taskId,
        ),
      };
    }

    const phases: TaskTrace["workflows"][number]["phases"] = [];
    for (const phase of PHASE_NAMES) {
      const relationshipType = PHASE_RELATIONSHIP_TYPE[phase];
      const steps: TraceStep[] = [];
      for (const step of workflow.phases[phase]) {
        const command = knowledge.indexes.commandsById.get(step.command_id);
        if (!command) {
          return {
            ok: false,
            error: knowledgeError(
              "MISSING_REFERENCED_COMMAND",
              `Workflow ${workflowId} phase ${phase} references missing command ${step.command_id}.`,
              `task_workflows.phases.${phase}`,
              workflowId,
            ),
          };
        }
        const sources = sourcesFor(knowledge, command);
        if (!Array.isArray(sources)) {
          return { ok: false, error: sources };
        }
        const verificationCommands = commandsFor(
          knowledge,
          command.verification_command_ids,
          "verification_command_ids",
          command.command_id,
        );
        if (!Array.isArray(verificationCommands)) {
          return { ok: false, error: verificationCommands };
        }
        const troubleshootingCommands = commandsFor(
          knowledge,
          command.troubleshooting_command_ids,
          "troubleshooting_command_ids",
          command.command_id,
        );
        if (!Array.isArray(troubleshootingCommands)) {
          return { ok: false, error: troubleshootingCommands };
        }
        const relatedCommands = commandsFor(
          knowledge,
          command.related_command_ids,
          "related_command_ids",
          command.command_id,
        );
        if (!Array.isArray(relatedCommands)) {
          return { ok: false, error: relatedCommands };
        }
        steps.push({
          phase,
          relationshipType,
          command_id: step.command_id,
          parameter_values: step.parameter_values,
          note: step.note,
          command,
          sources,
          verificationCommands,
          troubleshootingCommands,
          relatedCommands,
        });
      }
      phases.push({ phase, relationshipType, steps });
    }
    workflows.push({ workflow, phases });
  }

  return {
    ok: true,
    trace: {
      task,
      category,
      coverage: knowledge.indexes.coverageByCategoryId.get(task.category_id) ?? null,
      workflows,
      commandsCitingTask: knowledge.indexes.commandsCitingTask.get(taskId) ?? [],
    },
  };
}
