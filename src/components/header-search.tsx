"use client";

import { usePathname, useSearchParams } from "next/navigation";

export function HeaderSearchInput() {
  const pathname = usePathname();
  const params = useSearchParams();
  const q = pathname === "/search" ? (params.get("q") ?? "") : "";
  return (
    <input
      key={q}
      name="q"
      type="search"
      defaultValue={q}
      placeholder="Search restaurants"
      aria-label="Search restaurants"
      enterKeyHint="search"
      minLength={2}
      required
      className="placeholder:text-muted w-full min-w-0 border-0 bg-transparent outline-none"
    />
  );
}
