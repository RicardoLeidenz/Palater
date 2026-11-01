"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Explore" },
  { href: "/visited", label: "Visited" },
  { href: "/want-to-try", label: "Want to try" },
  { href: "/profile", label: "Profile" },
];

export function NavTabs() {
  const pathname = usePathname();
  const isOn = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav className="mx-auto flex max-w-[1080px] gap-6 overflow-x-auto px-4 text-sm" aria-label="Main">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={isOn(t.href) ? "page" : undefined}
          className={`shrink-0 border-b-2 py-2.5 no-underline ${
            isOn(t.href)
              ? "border-terracotta text-espresso font-medium"
              : "text-muted border-transparent"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
