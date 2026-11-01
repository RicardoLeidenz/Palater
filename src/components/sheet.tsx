"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Modal sheet on top of the native <dialog>: focus trapping, Esc to close and
 * an inert background come from the browser. Tapping the backdrop closes it.
 */
export function Sheet({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={labelledBy}
      onClose={onClose}
      onClick={(e) => {
        // The dialog itself has no padding, so a click whose target is the
        // dialog element can only be on the backdrop.
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="px-5 pt-6 pb-[calc(28px+env(safe-area-inset-bottom))]">{children}</div>
    </dialog>
  );
}
