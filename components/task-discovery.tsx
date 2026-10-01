"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { ProcedureView } from "@/components/procedure-view";
import { TaskForm } from "@/components/task-form";
import { filterDiscoveryTasks } from "@/lib/discovery/filter";
import { activityLabel, selectedTaskHandoff, selectionNotice, workflowLabel } from "@/lib/discovery/support";
import type { DiscoveryCatalog, DiscoveryTask } from "@/lib/discovery/types";
import { generateTaskProcedure } from "@/lib/portal/actions";
import { validationMessage } from "@/lib/portal/messages";
import { applyRun, beginGeneration, changeInput, emptyFormSession, selectTask } from "@/lib/portal/session";
import type { FormSession, TaskFormView } from "@/lib/portal/types";

export function TaskDiscovery({
  catalog,
  forms,
}: {
  catalog: DiscoveryCatalog;
  forms: Record<string, TaskFormView>;
}) {
  const [text, setText] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [session, setSession] = useState<FormSession>(emptyFormSession);

  const visible = useMemo(
    () => filterDiscoveryTasks(catalog.tasks, { text, categoryId: categoryId || null }),
    [catalog.tasks, text, categoryId],
  );
  const selected = catalog.tasks.find((task) => task.taskId === selectedId) ?? null;
  const listState = visible.length === 0 ? "NO_MATCHES" : selected ? "SELECTED" : "READY";

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    const buttons = [...event.currentTarget.querySelectorAll("button")];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) {
      return;
    }
    const next = buttons[index + (event.key === "ArrowDown" ? 1 : -1)];
    if (!next) {
      return;
    }
    event.preventDefault();
    next.focus();
  }

  return (
    <>
      <p className="limitation" role="note">
        Partial knowledge base. Documentation reviewed. Not device tested. Status {catalog.status}.
        Completeness claim {String(catalog.completenessClaim)}. Lab validation {String(catalog.labValidation)}.
      </p>
      <div className="context-bar">
        <p>
          Primary research boundary: {catalog.primaryBoundary.platform} / {catalog.primaryBoundary.software}{" "}
          {catalog.primaryBoundary.release}
        </p>
        <p>Excluded software: {catalog.excludedSoftware.join(", ")}</p>
        <p>
          {catalog.counts.tasks} tasks · {catalog.counts.workflowBacked} workflow-backed ·{" "}
          {catalog.counts.commandOnly} command-only
        </p>
      </div>
      <div className="workspace">
        <section className="panel catalog-panel" aria-labelledby="catalog-heading" data-ui-state={listState}>
          <div className="toolbar">
            <h2 id="catalog-heading">Task catalog</h2>
            <div className="filters">
              <label htmlFor="task-search">Search tasks</label>
              <input
                id="task-search"
                type="search"
                value={text}
                autoComplete="off"
                placeholder="Title, task ID, alias, or category"
                onChange={(event) => setText(event.target.value)}
              />
              <label htmlFor="task-category">Category</label>
              <select
                id="task-category"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">All categories</option>
                {catalog.categories.map((category) => (
                  <option key={category.categoryId} value={category.categoryId}>
                    {category.label} ({category.taskCount})
                  </option>
                ))}
              </select>
            </div>
            <p className="result-count" aria-live="polite">
              Showing {visible.length} of {catalog.counts.tasks}
            </p>
          </div>
          {visible.length === 0 ? (
            <p className="empty" role="status">
              No catalog tasks match this filter. No task identity was created from the search text.
            </p>
          ) : (
            <ul className="task-list" data-task-list onKeyDown={onListKeyDown}>
              {visible.map((task) => (
                <li key={task.taskId}>
                  <TaskButton task={task} pressed={task.taskId === selectedId} onSelect={chooseTask} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="panel selected-panel" id="selected-task">
          {selected ? (
            <SelectedTask
              task={selected}
              form={forms[selected.taskId]}
              session={session}
              onChange={(inputKey, value) => setSession((current) => changeInput(current, inputKey, value))}
              onGenerate={() => void generate(selected.taskId)}
            />
          ) : (
            <p>Select a task to see its support state.</p>
          )}
        </aside>
      </div>
      {session.result?.kind === "GENERATED" ? <ProcedureView procedure={session.result.procedure} /> : null}
    </>
  );

  function chooseTask(taskId: string) {
    setSelectedId(taskId);
    setSession((current) => selectTask(current, taskId));
  }

  async function generate(taskId: string) {
    const values = { ...session.values };
    const generationId = session.generationId + 1;
    setSession((current) =>
      current.generationId === session.generationId
        ? { ...current, generationId, status: "GENERATING", result: null }
        : current,
    );
    const run = await generateTaskProcedure(taskId, values);
    setSession((current) => applyRun(current, run, generationId));
  }
}

function TaskButton({
  task,
  pressed,
  onSelect,
}: {
  task: DiscoveryTask;
  pressed: boolean;
  onSelect: (taskId: string) => void;
}) {
  return (
    <button
      type="button"
      className="task-button"
      aria-pressed={pressed}
      aria-controls="selected-task"
      onClick={() => onSelect(task.taskId)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        onSelect(task.taskId);
      }}
    >
      <span className="task-title">{task.title}</span>
      <span className="task-id">{task.taskId}</span>
      <span className="task-meta">
        <span>{task.categoryLabel}</span>
        <span className={task.workflowAvailability === "present" ? "badge workflow" : "badge command"}>
          {workflowLabel(task.workflowAvailability)}
        </span>
        <span className={task.coverageStatus === "seed_partial" ? "badge partial" : "badge"}>
          {task.coverageStatus}
        </span>
        {task.inInitialVerticalSlice ? <span className="badge">Initial slice</span> : null}
      </span>
    </button>
  );
}

function SelectedTask({
  task,
  form,
  session,
  onChange,
  onGenerate,
}: {
  task: DiscoveryTask;
  form: TaskFormView | undefined;
  session: FormSession;
  onChange: (inputKey: string, value: string) => void;
  onGenerate: () => void;
}) {
  const handoff = selectedTaskHandoff(task);
  const commandOnly = handoff.workflowAvailability === "absent";
  const validation = session.result?.kind === "VALIDATION" ? session.result.validation : null;
  return (
    <div
      data-selection-state={commandOnly ? "WORKFLOW_NOT_ESTABLISHED" : "SELECTED"}
      data-generation-state={session.status}
    >
      <h2>Selected task</h2>
      <p className={commandOnly ? "notice command" : "notice workflow"}>{selectionNotice(task)}</p>
      <dl>
        <dt>Title</dt>
        <dd>{handoff.title}</dd>
        <dt>Task ID</dt>
        <dd>
          <code>{handoff.taskId}</code>
        </dd>
        <dt>Category</dt>
        <dd>{handoff.categoryLabel}</dd>
        <dt>Workflow</dt>
        <dd>{workflowLabel(handoff.workflowAvailability)}</dd>
        <dt>Coverage</dt>
        <dd>{handoff.coverageStatus}</dd>
        <dt>Activity</dt>
        <dd>
          {activityLabel(handoff.activityEvidence)} ({handoff.activityEvidence})
        </dd>
        <dt>Platform boundary</dt>
        <dd>{handoff.platformBoundary ?? "No workflow platform boundary on this task."}</dd>
        <dt>Validation</dt>
        <dd>{handoff.validationStatus ?? "Not established"}</dd>
      </dl>
      {commandOnly ? null : form?.state === "FORM" ? (
        <TaskForm
          taskId={task.taskId}
          fields={form.fields}
          values={session.values}
          validation={validation}
          busy={session.status === "GENERATING"}
          onChange={onChange}
          onGenerate={onGenerate}
        />
      ) : (
        <p className="notice command" role="alert">
          {form?.errors[0]?.message ?? "The input contract is not available. No procedure form is shown."}
        </p>
      )}
      <p role="status">
        {session.status === "GENERATING"
          ? "Generating the procedure from the catalog. This does not contact a device."
          : validation
            ? validationMessage(validation)
            : session.result?.kind === "BLOCKED"
              ? `${session.result.state}. ${session.result.messages.join(" ")}`
              : session.result?.kind === "DATA_ERROR"
                ? `DATA_ERROR. ${session.result.errors.map((error) => error.message).join(" ")}`
                : session.result?.kind === "GENERATED"
                  ? "READY. GENERATED. The procedure below uses the submitted values. Device execution is not authorized."
                  : ""}
      </p>
    </div>
  );
}
