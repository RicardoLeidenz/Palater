import type { ReactNode } from "react";

/** Shown when a list or screen has nothing in it yet. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border-line rounded-2xl border border-dashed px-6 py-10 text-center">
      <p className="font-serif text-2xl">{title}</p>
      {children && <div className="text-muted mx-auto mt-2 max-w-sm text-sm">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Shown when loading something failed. */
export function ErrorState({
  title = "Something went wrong",
  children,
  action,
}: {
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div role="alert" className="border-terracotta/40 bg-paper rounded-2xl border px-6 py-8 text-center">
      <p className="text-terracotta font-serif text-2xl">{title}</p>
      {children && <div className="text-muted mx-auto mt-2 max-w-sm text-sm">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}
