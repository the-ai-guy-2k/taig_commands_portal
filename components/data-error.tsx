import type { DiscoveryPageError } from "@/lib/discovery/types";

export function DataError({ errors }: { errors: readonly DiscoveryPageError[] }) {
  return (
    <section className="panel error-panel" data-ui-state="DATA_ERROR" role="alert">
      <h2>Task catalog unavailable</h2>
      <p>
        The portal cannot show tasks because the knowledge package or task catalog did not load. No
        substitute task list is available.
      </p>
      <ul>
        {errors.map((error) => (
          <li key={`${error.code}:${error.message}`}>
            <code>{error.code}</code> {error.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
