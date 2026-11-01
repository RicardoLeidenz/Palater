import { EmptyState } from "@/components/states";

export default function WantToTryPage() {
  return (
    <section>
      <h1 className="display mb-6">Want to try</h1>
      <EmptyState title="Your list is empty">
        Save a restaurant or a dish you want to try and it will wait for you here.
      </EmptyState>
    </section>
  );
}
