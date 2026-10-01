import { loadKnowledgePackage } from "@/lib/knowledge";
import { discoverTaskInputContract, validateTaskInputs } from "@/lib/inputs";
import { buildTaskCatalog, INITIAL_VERTICAL_SLICE_TASK_IDS, resolveTask } from "@/lib/tasks";
import { resolveWorkflow } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const loaded = await loadKnowledgePackage();
  const catalog = loaded.ok ? buildTaskCatalog(loaded.knowledge) : null;
  const proof =
    loaded.ok && catalog?.ok === true
      ? INITIAL_VERTICAL_SLICE_TASK_IDS.map((taskId) => {
          const resolved = resolveTask(catalog.catalog, taskId);
          if (resolved.state !== "RESOLVED") {
            return {
              taskId,
              state: resolved.state,
              inputs: [] as string[],
              missing: [] as string[],
              workflowState: resolved.state,
              workflowId: "",
              rollback: "",
              coverage: "",
              phases: [] as string[],
              sources: "",
            };
          }
          const discovery = discoverTaskInputContract(loaded.knowledge, resolved.task);
          const emptyValidation = validateTaskInputs(discovery, {});
          const readyValues = discovery.ok
            ? Object.fromEntries(
                discovery.contract.inputs.filter((input) => input.requirement === "required").map((input) => [input.inputKey, input.exampleValue]),
              )
            : {};
          const readyValidation = validateTaskInputs(discovery, readyValues);
          const workflow = resolveWorkflow(loaded.knowledge, resolved.task, discovery, readyValidation);
          const resolvedWorkflow = workflow.state === "RESOLVED" ? workflow.workflows[0] : null;
          return {
            taskId,
            state: emptyValidation.state,
            inputs: discovery.ok ? discovery.contract.inputs.map((input) => `${input.inputKey} (${input.requirement})`) : [],
            missing: emptyValidation.missing.map((item) => item.inputKey),
            workflowState: workflow.state,
            workflowId: resolvedWorkflow?.workflowId ?? "",
            rollback: resolvedWorkflow?.rollbackStrategy ?? "",
            coverage: workflow.state === "RESOLVED" ? workflow.support.taskCoverageStatus : "",
            phases: resolvedWorkflow
              ? resolvedWorkflow.phases.map((phase) => `${phase.phase} ${phase.steps.length}: ${phase.steps.map((step) => step.commandId).join(", ")}`)
              : [],
            sources: resolvedWorkflow?.sourceIds.join(", ") ?? "",
          };
        })
      : [];

  return (
    <main>
      <h1>TAIG Command Portal</h1>
      <p className="lede">
        The portal loads the Cisco research package, resolves task identity, checks required inputs,
        and resolves the workflow and command references. It does not render commands or generate a
        procedure.
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
          <h2>Initial task workflows</h2>
          <ul>
            {proof.map((item) => (
              <li key={item.taskId}>
                <code>{item.taskId}</code> — {item.state}
                {item.inputs.length > 0 ? `; required: ${item.inputs.join(", ")}` : ""}
                {item.missing.length > 0 ? `; missing: ${item.missing.join(", ")}` : ""}
                {item.workflowState === "RESOLVED" ? (
                  <>
                    {" "}
                    — workflow <code>{item.workflowId}</code>, {item.rollback}, {item.coverage}; sources {item.sources}
                    <ul>
                      {item.phases.map((phase) => (
                        <li key={phase}>{phase}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <> — workflow {item.workflowState}</>
                )}
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
