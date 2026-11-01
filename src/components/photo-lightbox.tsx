"use client";

import { useEffect, useRef } from "react";

/** Full-size view of a plate photo. Esc, the close button or a tap outside closes it. */
export function PhotoLightbox({
  photo,
  alt,
  onClose,
}: {
  photo: { fullUrl: string; width: number; height: number } | null;
  alt: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (photo && !d.open) d.showModal();
    if (!photo && d.open) d.close();
  }, [photo]);

  return (
    <dialog
      ref={ref}
      aria-label={alt}
      onClose={onClose}
      onClick={onClose}
      className="m-auto max-h-none max-w-none bg-transparent p-0 backdrop:bg-[rgb(20_14_11/0.88)]"
    >
      {photo && (
        <figure className="flex flex-col items-center gap-3 p-4">
          {/* Private, short-lived signed URL: deliberately not run through next/image's shared cache. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.fullUrl}
            alt={alt}
            width={photo.width}
            height={photo.height}
            className="max-h-[80dvh] w-auto max-w-[min(92vw,1000px)] rounded-2xl object-contain"
          />
          <button type="button" className="btn border-sand text-sand" onClick={onClose}>
            Close
          </button>
        </figure>
      )}
    </dialog>
  );
}
