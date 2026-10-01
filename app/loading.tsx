import { ProductHeader } from "@/components/product-header";

export default function Loading() {
  return (
    <div className="shell">
      <ProductHeader />
      <p className="panel loading-panel" role="status" data-ui-state="LOADING">
        Loading the task catalog.
      </p>
    </div>
  );
}
