import Link from "next/link";
import { EmptyState } from "@/components/states";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-20">
      <EmptyState
        title="Nothing on this plate"
        action={
          <Link href="/" className="btn btn-primary">
            Back to Palater
          </Link>
        }
      >
        We couldn&apos;t find that page.
      </EmptyState>
    </main>
  );
}
