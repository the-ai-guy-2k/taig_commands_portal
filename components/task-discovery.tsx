"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { filterDiscoveryTasks } from "@/lib/discovery/filter";
import { activityLabel, selectedTaskHandoff, selectionNotice, workflowLabel } from "@/lib/discovery/support";
import type { DiscoveryCatalog, DiscoveryTask } from "@/lib/discovery/types";

export function TaskDiscovery({ catalog }: { catalog: DiscoveryCatalog }) {
  const [text, setText] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
                  <TaskButton task={task} pressed={task.taskId === selectedId} onSelect={setSelectedId} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="panel selected-panel" id="selected-task" aria-live="polite">
          {selected ? <SelectedTask task={selected} /> : <p>Select a task to see its support state.</p>}
        </aside>
      </div>
    </>
  );
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

function SelectedTask({ task }: { task: DiscoveryTask }) {
  const handoff = selectedTaskHandoff(task);
  const commandOnly = handoff.workflowAvailability === "absent";
  return (
    <div data-selection-state={commandOnly ? "WORKFLOW_NOT_ESTABLISHED" : "SELECTED"}>
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
      {task.aliases.length > 0 ? (
        <>
          <h3>Catalog aliases</h3>
          <ul className="alias-list">
            {task.aliases.map((alias) => (
              <li key={alias}>{alias}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
