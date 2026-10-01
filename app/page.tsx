import { loadKnowledgePackage } from "@/lib/knowledge";
import { discoverTaskInputContract, validateTaskInputs } from "@/lib/inputs";
import { generateProcedure } from "@/lib/procedures";
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
              missing: [] as string[],
              procedureState: resolved.state,
              activity: "",
              workflowId: "",
              rollback: "",
              coverage: "",
              completeness: "",
              labValidation: "",
              knownGaps: 0,
              sections: [] as string[],
            };
          }
          const discovery = discoverTaskInputContract(loaded.knowledge, resolved.task);
          const emptyValidation = validateTaskInputs(discovery, {});
          const readyValidation = validateTaskInputs(discovery, PROOF_RENDER_VALUES[taskId] ?? {});
          const workflow = resolveWorkflow(loaded.knowledge, resolved.task, discovery, readyValidation);
          const rendered = renderWorkflowCommands(loaded.knowledge, workflow, readyValidation);
          const procedure = generateProcedure(loaded.knowledge, resolved.task, discovery, readyValidation, workflow, rendered);
          const generatedWorkflow = procedure.state === "GENERATED" ? procedure.workflows[0] : null;
          return {
            taskId,
            state: emptyValidation.state,
            missing: emptyValidation.missing.map((item) => item.inputKey),
            procedureState: procedure.state,
            activity: procedure.state === "GENERATED" ? procedure.activityEvidence : "",
            workflowId: generatedWorkflow?.workflowId ?? "",
            rollback: generatedWorkflow?.rollback.strategy ?? "",
            coverage: procedure.state === "GENERATED" ? procedure.support.taskCoverageStatus : "",
            completeness: procedure.state === "GENERATED" ? String(procedure.support.completenessClaim) : "",
            labValidation: procedure.state === "GENERATED" ? String(procedure.support.labValidation) : "",
            knownGaps: procedure.state === "GENERATED" ? procedure.support.knownGaps.length : 0,
            sections: generatedWorkflow
              ? generatedWorkflow.sections.map((section) =>
                  section.steps.length === 0
                    ? `${section.phase}: empty`
                    : `${section.phase}: ${section.steps.map((step) => step.renderedCommand).join(" | ")}`,
                )
              : [],
          };
        })
      : [];

  return (
    <main>
      <h1>TAIG Command Portal</h1>
      <p className="lede">
        The portal loads the Cisco research package, resolves a task, checks its inputs, renders the
        workflow commands, and assembles those commands into a procedure. It does not add commands or
        authorize device execution.
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
          <h2>Initial procedures</h2>
          <ul>
            {proof.map((item) => (
              <li key={item.taskId}>
                <code>{item.taskId}</code> — empty input {item.state}
                {item.missing.length > 0 ? `; missing: ${item.missing.join(", ")}` : ""}
                {item.procedureState === "GENERATED" ? (
                  <>
                    {" "}
                    — {item.procedureState}, {item.activity}, {item.workflowId}, rollback {item.rollback}, {item.coverage},
                    completeness {item.completeness}, lab validation {item.labValidation}, known gaps {item.knownGaps}
                    <ul>
                      {item.sections.map((section) => (
                        <li key={section}>{section}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <> — {item.procedureState}</>
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
