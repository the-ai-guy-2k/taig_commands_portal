"use client";

import { useState } from "react";
import { KnownGapsPanel, ProcedureStatus } from "@/components/coverage-presentation";
import { sourceBoundaryNote } from "@/lib/coverage/present";
import { activityLabel } from "@/lib/discovery/support";
import type { ProcedurePresentation } from "@/lib/portal/types";

const PHASE_LABEL: Record<string, string> = {
  pre_check: "Pre-check",
  configuration: "Configuration",
  verification: "Verification",
  troubleshooting: "Troubleshooting",
};

export function ProcedureView({ procedure }: { procedure: ProcedurePresentation }) {
  return (
    <section
      className={`panel procedure ${procedure.activityEvidence === "configuration_changing" ? "changing" : "readonly"}`}
      id="procedure"
      aria-labelledby="procedure-heading"
      data-activity={procedure.activityEvidence}
    >
      <h2 id="procedure-heading">Generated procedure</h2>
      <ProcedureStatus
        activity={procedure.activityEvidence}
        activityLabel={activityLabel(procedure.activityEvidence)}
        configurationRequired={procedure.configurationRequired}
        deviceExecutionAuthorized={procedure.deviceExecutionAuthorized}
      />
      <p className="notice application">
        Generation succeeded as an application result. It is not proof of live-device validity. Copying a command does not
        run it.
      </p>
      <h3>Coverage and support</h3>
      <dl>
        <dt>Task coverage</dt>
        <dd>{procedure.support.taskCoverageStatus}</dd>
        <dt>Package status</dt>
        <dd>{procedure.support.packageStatus}</dd>
        <dt>Validation status</dt>
        <dd>{procedure.support.validationStatus ?? procedure.validationStatus}</dd>
        <dt>Completeness claim</dt>
        <dd>{String(procedure.support.completenessClaim)}</dd>
        <dt>Lab validation</dt>
        <dd>{String(procedure.support.labValidation)}</dd>
        <dt>Platform boundary</dt>
        <dd>{procedure.platformBoundary}</dd>
        <dt>Known gaps</dt>
        <dd>{procedure.support.knownGaps.length}</dd>
        <dt>Device execution authorized</dt>
        <dd>{String(procedure.deviceExecutionAuthorized)}</dd>
      </dl>

      <h3>Task summary</h3>
      <dl>
        <dt>Title</dt>
        <dd>{procedure.taskTitle}</dd>
        <dt>Task ID</dt>
        <dd>
          <code>{procedure.taskId}</code>
        </dd>
        <dt>Activity</dt>
        <dd>
          {activityLabel(procedure.activityEvidence)} ({procedure.activityEvidence})
        </dd>
        <dt>Workflow ID</dt>
        <dd>
          <code>{procedure.workflowId}</code>
        </dd>
      </dl>

      <h3>Engineer inputs</h3>
      <ul className="plain-list">
        {procedure.engineerInputs.map((input) => (
          <li key={input.inputKey}>
            <code>{input.inputKey}</code> = {input.acceptedValue} ({input.requirement})
          </li>
        ))}
      </ul>

      <h3>Environment and support</h3>
      <dl>
        <dt>Platform boundary</dt>
        <dd>{procedure.platformBoundary}</dd>
        <dt>Primary boundary</dt>
        <dd>
          {procedure.environment.primaryBoundary.platform} / {procedure.environment.primaryBoundary.software}{" "}
          {procedure.environment.primaryBoundary.release}
        </dd>
        <dt>Coverage</dt>
        <dd>{procedure.support.taskCoverageStatus}</dd>
        <dt>Package status</dt>
        <dd>{procedure.support.packageStatus}</dd>
        <dt>Completeness claim</dt>
        <dd>{String(procedure.support.completenessClaim)}</dd>
        <dt>Lab validation</dt>
        <dd>{String(procedure.support.labValidation)}</dd>
        <dt>Validation</dt>
        <dd>{procedure.support.validationStatus ?? procedure.validationStatus}</dd>
        <dt>Excluded software</dt>
        <dd>{procedure.environment.excludedSoftware.join(", ")}</dd>
      </dl>

      {procedure.sections.map((section) => (
        <section key={section.phase} className={section.phase === "troubleshooting" ? "phase troubleshooting" : "phase"}>
          <h3>{PHASE_LABEL[section.phase] ?? section.phase}</h3>
          {section.phase === "troubleshooting" ? <p>Troubleshooting is not the normal path.</p> : null}
          {section.steps.length === 0 ? (
            <p>
              {section.phase === "configuration" && !procedure.configurationRequired
                ? "No configuration commands. Configuration is not required."
                : "No commands in this phase."}
            </p>
          ) : (
            <ol className="command-list">
              {section.steps.map((step) => (
                <li key={`${section.phase}-${step.stepIndex}-${step.commandId}`}>
                  <CommandBlock command={step.renderedCommand} label={`${section.phase} ${step.commandId}`} />
                  <p className="command-meta">
                    <code>{step.commandId}</code>
                    {step.sourceIds.length > 0 ? ` · Sources ${step.sourceIds.join(", ")}` : ""}
                    {step.normalPath ? "" : " · Not the normal path"}
                  </p>
                  {step.caution ? (
                    <p className="caution">
                      Caution ({step.level}, {step.effect}): {step.caution}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}

      <h3>Rollback and recovery</h3>
      <p>
        Strategy <code>{procedure.rollback.strategy}</code>
      </p>
      {procedure.rollback.instructions.length === 0 ? (
        <p>No rollback instructions are recorded.</p>
      ) : (
        <ul className="plain-list">
          {procedure.rollback.instructions.map((instruction) => (
            <li key={instruction}>{instruction}</li>
          ))}
        </ul>
      )}

      <h3>Warnings and cautions</h3>
      {procedure.warnings.length === 0 ? (
        <p>No source-backed cautions are recorded on this procedure.</p>
      ) : (
        <ul className="plain-list">
          {procedure.warnings.map((warning) => (
            <li key={`${warning.phase}-${warning.commandId}-${warning.caution}`}>
              {warning.phase} <code>{warning.commandId}</code> ({warning.effect}): {warning.caution}
            </li>
          ))}
        </ul>
      )}

      <h3>Sources</h3>
      <ul className="plain-list">
        {procedure.sources.map((source) => {
          const boundaryNote = sourceBoundaryNote(source, procedure.environment.primaryBoundary);
          return (
            <li key={source.sourceId}>
              <code>{source.sourceId}</code> {source.title}. Platform {source.platformBoundary}. Release{" "}
              {source.releaseBoundary}.
              {boundaryNote ? ` ${boundaryNote}` : ""}
            </li>
          );
        })}
      </ul>

      <KnownGapsPanel gaps={procedure.support.knownGaps} />
    </section>
  );
}

function CommandBlock({ command, label }: { command: string; label: string }) {
  const [copyState, setCopyState] = useState("");
  return (
    <div className="command">
      <pre>{command}</pre>
      <button
        type="button"
        className="copy-button"
        aria-label={`Copy ${label}`}
        onClick={() => {
          void navigator.clipboard.writeText(command).then(
            () => setCopyState("Copied"),
            () => setCopyState("Copy failed"),
          );
        }}
      >
        {copyState || "Copy"}
      </button>
    </div>
  );
}
