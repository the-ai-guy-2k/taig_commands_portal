import { loadKnowledgePackage } from "@/lib/knowledge";
import { discoverTaskInputContract, validateTaskInputs } from "@/lib/inputs";
import { buildTaskCatalog, INITIAL_VERTICAL_SLICE_TASK_IDS, resolveTask } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const loaded = await loadKnowledgePackage();
  const catalog = loaded.ok ? buildTaskCatalog(loaded.knowledge) : null;
  const proof =
    loaded.ok && catalog?.ok === true
      ? INITIAL_VERTICAL_SLICE_TASK_IDS.map((taskId) => {
          const resolved = resolveTask(catalog.catalog, taskId);
          if (resolved.state !== "RESOLVED") {
            return { taskId, state: resolved.state, inputs: [] as string[], missing: [] as string[] };
          }
          const discovery = discoverTaskInputContract(loaded.knowledge, resolved.task);
          const validation = validateTaskInputs(discovery, {});
          return {
            taskId,
            state: validation.state,
            inputs: discovery.ok ? discovery.contract.inputs.map((input) => `${input.inputKey} (${input.requirement})`) : [],
            missing: validation.missing.map((item) => item.inputKey),
          };
        })
      : [];

  return (
    <main>
      <h1>TAIG Command Portal</h1>
      <p className="lede">
        The portal loads the Cisco research package, resolves task identity, and checks the inputs a
        workflow proves are required. It does not render commands or generate a procedure.
      </p>
      {loaded.ok && catalog?.ok === true ? (
        <>
          <p>
            Load status: <span className="status">Passed</span>
          </p>
          <dl>
            <dt>Schema version</dt>
            <dd>{catalog.catalog.package.schemaVersion}</dd>
            <dt>Dataset version</dt>
            <dd>{catalog.catalog.package.datasetVersion}</dd>
            <dt>Package status</dt>
            <dd>{catalog.catalog.package.status}</dd>
            <dt>Completeness claim</dt>
            <dd>{String(catalog.catalog.package.completenessClaim)}</dd>
            <dt>Lab validation</dt>
            <dd>{String(catalog.catalog.package.labValidation)}</dd>
            <dt>Cataloged tasks</dt>
            <dd>{catalog.catalog.counts.tasks}</dd>
            <dt>Workflow-backed</dt>
            <dd>{catalog.catalog.counts.workflowBacked}</dd>
            <dt>Command-only</dt>
            <dd>{catalog.catalog.counts.commandOnly}</dd>
            <dt>Primary boundary</dt>
            <dd>
              {catalog.catalog.package.primaryBoundary.platform} / {catalog.catalog.package.primaryBoundary.software}{" "}
              {catalog.catalog.package.primaryBoundary.release}
            </dd>
            <dt>Knowledge directory</dt>
            <dd>
              <code>{catalog.catalog.package.directory}</code>
            </dd>
          </dl>
          <h2>Initial task inputs</h2>
          <ul>
            {proof.map((item) => (
              <li key={item.taskId}>
                <code>{item.taskId}</code> — {item.state}
                {item.inputs.length > 0 ? `; required: ${item.inputs.join(", ")}` : ""}
                {item.missing.length > 0 ? `; missing: ${item.missing.join(", ")}` : ""}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p>
            Load status: <span className="status failed">Failed closed</span>
          </p>
          <ul>
            {(loaded.ok ? catalog?.ok === false ? catalog.errors : [] : loaded.errors).map((error) => (
              <li key={`${error.code}:${"taskId" in error ? error.taskId ?? "" : ""}:${error.message}`}>
                <code>{error.code}</code> — {error.message}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
