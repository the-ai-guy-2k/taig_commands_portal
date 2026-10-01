import { DataError } from "@/components/data-error";
import { ProductHeader } from "@/components/product-header";
import { TaskDiscovery } from "@/components/task-discovery";
import { discoveryPageModel } from "@/lib/discovery/view";
import { loadTaskCatalog } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const model = discoveryPageModel(await loadTaskCatalog());
  if (model.state === "DATA_ERROR") {
    return (
      <div className="shell">
        <ProductHeader />
        <DataError errors={model.errors} />
      </div>
    );
  }
  return (
    <div className="shell">
      <ProductHeader />
      <TaskDiscovery catalog={model.catalog} />
    </div>
  );
}
