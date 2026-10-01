import { FailurePanel } from "@/components/coverage-presentation";
import { presentLoaderFailure } from "@/lib/coverage/present";
import type { DiscoveryPageError } from "@/lib/discovery/types";

export function DataError({ errors }: { errors: readonly DiscoveryPageError[] }) {
  const notice = presentLoaderFailure(errors);
  return (
    <section className="panel error-panel" data-ui-state="DATA_ERROR">
      <h2>Knowledge package unavailable</h2>
      <FailurePanel notice={notice} />
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
