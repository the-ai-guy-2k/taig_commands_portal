import { loadKnowledgePackage } from "@/lib/knowledge";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const result = await loadKnowledgePackage();

  return (
    <main>
      <h1>TAIG Command Portal</h1>
      <p className="lede">
        Capability 1 loads the local Cisco command research package and reports whether that
        package satisfies the verified knowledge contract.
      </p>
      {result.ok ? (
        <>
          <p>
            Load status: <span className="status">Passed</span>
          </p>
          <dl>
            <dt>Schema version</dt>
            <dd>{result.knowledge.dataset.metadata.schema_version}</dd>
            <dt>Dataset version</dt>
            <dd>{result.knowledge.dataset.metadata.dataset_version}</dd>
            <dt>Package status</dt>
            <dd>{result.knowledge.dataset.metadata.status}</dd>
            <dt>Completeness claim</dt>
            <dd>{String(result.knowledge.dataset.metadata.completeness_claim)}</dd>
            <dt>Lab validation</dt>
            <dd>{String(result.knowledge.dataset.metadata.lab_validation)}</dd>
            <dt>Commands</dt>
            <dd>{result.knowledge.dataset.metadata.command_count}</dd>
            <dt>Workflows</dt>
            <dd>{result.knowledge.dataset.metadata.workflow_count}</dd>
            <dt>Sources</dt>
            <dd>{result.knowledge.dataset.metadata.source_count}</dd>
            <dt>Knowledge directory</dt>
            <dd>
              <code>{result.knowledge.directory}</code>
            </dd>
          </dl>
        </>
      ) : (
        <>
          <p>
            Load status: <span className="status failed">Failed closed</span>
          </p>
          <ul>
            {result.errors.map((error) => (
              <li key={`${error.code}:${error.path ?? ""}:${error.message}`}>
                <code>{error.code}</code> — {error.message}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
