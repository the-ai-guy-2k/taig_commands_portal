import { INITIAL_VERTICAL_SLICE_TASK_IDS, loadTaskCatalog, resolveTask } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const result = await loadTaskCatalog();
  const proof =
    result.ok === true
      ? INITIAL_VERTICAL_SLICE_TASK_IDS.map((taskId) => resolveTask(result.catalog, taskId))
      : [];

  return (
    <main>
      <h1>TAIG Command Portal</h1>
      <p className="lede">
        The knowledge loader validates the Cisco research package. The task catalog resolves task
        identity and support state. It does not generate procedures.
      </p>
      {result.ok === true ? (
        <>
          <p>
            Load status: <span className="status">Passed</span>
          </p>
          <dl>
            <dt>Schema version</dt>
            <dd>{result.catalog.package.schemaVersion}</dd>
            <dt>Dataset version</dt>
            <dd>{result.catalog.package.datasetVersion}</dd>
            <dt>Package status</dt>
            <dd>{result.catalog.package.status}</dd>
            <dt>Completeness claim</dt>
            <dd>{String(result.catalog.package.completenessClaim)}</dd>
            <dt>Lab validation</dt>
            <dd>{String(result.catalog.package.labValidation)}</dd>
            <dt>Cataloged tasks</dt>
            <dd>{result.catalog.counts.tasks}</dd>
            <dt>Workflow-backed</dt>
            <dd>{result.catalog.counts.workflowBacked}</dd>
            <dt>Command-only</dt>
            <dd>{result.catalog.counts.commandOnly}</dd>
            <dt>Primary boundary</dt>
            <dd>
              {result.catalog.package.primaryBoundary.platform} / {result.catalog.package.primaryBoundary.software}{" "}
              {result.catalog.package.primaryBoundary.release}
            </dd>
            <dt>Knowledge directory</dt>
            <dd>
              <code>{result.catalog.package.directory}</code>
            </dd>
          </dl>
          <h2>Initial task proof set</h2>
          <ul>
            {proof.map((resolved) =>
              resolved.state === "RESOLVED" ? (
                <li key={resolved.task.taskId}>
                  <code>{resolved.task.taskId}</code> — {resolved.task.workflowAvailability},{" "}
                  {resolved.task.coverageStatus}, {resolved.task.activityEvidence}
                </li>
              ) : (
                <li key={resolved.state}>{resolved.state}</li>
              ),
            )}
          </ul>
        </>
      ) : (
        <>
          <p>
            Load status: <span className="status failed">Failed closed</span>
          </p>
          <ul>
            {result.errors.map((error) => (
              <li key={`${error.code}:${error.taskId ?? ""}:${error.message}`}>
                <code>{error.code}</code> — {error.message}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
