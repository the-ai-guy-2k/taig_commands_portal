import { loadKnowledgePackage } from "@/lib/knowledge";
import { discoverTaskInputContract, validateTaskInputs } from "@/lib/inputs";
import { renderWorkflowCommands } from "@/lib/rendering";
import { buildTaskCatalog, INITIAL_VERTICAL_SLICE_TASK_IDS, resolveTask } from "@/lib/tasks";
import { resolveWorkflow } from "@/lib/workflows";

const PROOF_RENDER_VALUES: Record<string, Record<string, string | number>> = {
  "task-locate-mac": { mac: "aabb.ccdd.eeff", interface: "Gi1/0/24", vlan_id: 30 },
  "task-interface-drops": { interface: "Gi1/0/24" },
  "task-lacp-check": { group: 5 },
  "task-add-trunk-vlan": { interface: "Gi1/0/48", vlan_list: "30,40", vlan_id: 30 },
};

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
              renderState: resolved.state,
              activity: "",
              commands: [] as string[],
            };
          }
          const discovery = discoverTaskInputContract(loaded.knowledge, resolved.task);
          const emptyValidation = validateTaskInputs(discovery, {});
          const readyValidation = validateTaskInputs(discovery, PROOF_RENDER_VALUES[taskId] ?? {});
          const workflow = resolveWorkflow(loaded.knowledge, resolved.task, discovery, readyValidation);
          const rendered = renderWorkflowCommands(loaded.knowledge, workflow, readyValidation);
          return {
            taskId,
            state: emptyValidation.state,
            inputs: discovery.ok ? discovery.contract.inputs.map((input) => `${input.inputKey} (${input.requirement})`) : [],
            missing: emptyValidation.missing.map((item) => item.inputKey),
            renderState: rendered.state,
            activity: rendered.state === "RENDERED" ? rendered.activityEvidence : "",
            commands:
              rendered.state === "RENDERED"
                ? rendered.workflows[0].phases.flatMap((phase) =>
                    phase.commands.map((command) => `${phase.phase} ${command.commandId}: ${command.renderedCommand}`),
                  )
                : [],
          };
        })
      : [];

  return (
    <main>
      <h1>TAIG Command Portal</h1>
      <p className="lede">
        The portal loads the Cisco research package, resolves task identity, checks required inputs,
        resolves the workflow, and renders each command template with the validated engineer value.
        It does not assemble a procedure.
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
          <h2>Initial rendered commands</h2>
          <ul>
            {proof.map((item) => (
              <li key={item.taskId}>
                <code>{item.taskId}</code> — empty input {item.state}
                {item.missing.length > 0 ? `; missing: ${item.missing.join(", ")}` : ""}
                {item.renderState === "RENDERED" ? (
                  <>
                    {" "}
                    — proof values {item.renderState}, {item.activity}
                    <ul>
                      {item.commands.map((command) => (
                        <li key={command}>{command}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <> — proof values {item.renderState}</>
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
