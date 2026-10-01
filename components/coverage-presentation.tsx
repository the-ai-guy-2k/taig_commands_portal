import type { EngineerNotice } from "@/lib/coverage/types";
import type { CoverageFact } from "@/lib/coverage/types";

export function CoverageBadge({ label }: { label: string }) {
  return <span className="badge">{label}</span>;
}

export function SupportNotice({ notice, id }: { notice: EngineerNotice; id?: string }) {
  return (
    <div
      id={id}
      className={`notice ${notice.category}`}
      role={notice.category === "blocking" ? "alert" : "status"}
      tabIndex={-1}
      data-backend-state={notice.backendState}
    >
      <p className="notice-headline">{notice.headline}</p>
      <p>{notice.explanation}</p>
      <p className="notice-next">Next: {notice.nextAction}</p>
      <p className="technical-detail">Technical state: {notice.technicalDetail}</p>
    </div>
  );
}

export function FailurePanel({ notice, id }: { notice: EngineerNotice; id?: string }) {
  return <SupportNotice notice={notice} id={id} />;
}

export function ValidationNotice({ notice, id }: { notice: EngineerNotice; id?: string }) {
  return <SupportNotice notice={notice} id={id} />;
}

export function PackageCoverage({ facts }: { facts: readonly CoverageFact[] }) {
  return (
    <section className="package-coverage" aria-labelledby="package-coverage-heading">
      <h2 id="package-coverage-heading">Package coverage</h2>
      <p>These limits belong to the research package. They are not application load failures.</p>
      <dl>
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>
              <strong>{fact.value}</strong>
              <span>{fact.meaning}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function PlatformBoundary({
  platform,
  software,
  release,
  excludedSoftware,
}: {
  platform: string;
  software: string;
  release: string;
  excludedSoftware: readonly string[];
}) {
  return (
    <div className="context-bar">
      <p>
        Primary research boundary: {platform} / {software} {release}
      </p>
      <p>Excluded software: {excludedSoftware.join(", ")}</p>
    </div>
  );
}

export function ProcedureStatus({
  activity,
  activityLabel,
  configurationRequired,
  deviceExecutionAuthorized,
}: {
  activity: string;
  activityLabel: string;
  configurationRequired: boolean;
  deviceExecutionAuthorized: false;
}) {
  const changing = activity === "configuration_changing";
  return (
    <div className={changing ? "activity-banner changing" : "activity-banner readonly"} data-activity={activity}>
      <p className="notice-headline">
        {activityLabel} ({activity})
      </p>
      <p>
        {changing
          ? "This procedure contains configuration commands. Device execution is not authorized, and generation does not push configuration."
          : activity === "read_only"
            ? "Activity is read-only. Configuration is not required. The procedure remains guidance only. Read-only does not add a harmlessness claim."
            : "Activity is not established. No procedure claim is added beyond the recorded activity."}
      </p>
      <p>
        {configurationRequired ? "Configuration commands are part of this procedure." : "No configuration phase is required."}{" "}
        Device execution authorized: {String(deviceExecutionAuthorized)}.
      </p>
    </div>
  );
}

export function KnownGapsPanel({ gaps }: { gaps: readonly string[] }) {
  return (
    <details className="gaps">
      <summary>
        Known gaps ({gaps.length}). These are coverage limitations, not additional warnings.
      </summary>
      {gaps.length === 0 ? (
        <p>No known-gap records are attached to this procedure.</p>
      ) : (
        <ul className="gap-list">
          {gaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      )}
    </details>
  );
}
