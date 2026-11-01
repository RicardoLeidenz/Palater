import Link from "next/link";
import { Logo } from "./logo";
import { NavTabs } from "./nav-tabs";

export function Header({ initial }: { initial: string }) {
  return (
    <header className="bg-sand border-line sticky top-0 z-10 border-b">
      <div className="mx-auto flex max-w-[1080px] items-center gap-4 px-4 py-3.5">
        <Logo className="text-[26px]" />
        <form action="/search" className="flex-1" role="search">
          <label className="bg-paper border-line flex items-center gap-2 rounded-full border px-4 py-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="text-muted shrink-0">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              name="q"
              type="search"
              placeholder="Search restaurants"
              aria-label="Search restaurants"
              enterKeyHint="search"
              className="placeholder:text-muted w-full min-w-0 border-0 bg-transparent outline-none"
            />
          </label>
        </form>
        <Link
          href="/profile"
          aria-label="Your profile"
          className="bg-plum text-sand grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold no-underline"
        >
          {initial}
        </Link>
      </div>
      <NavTabs />
    </header>
  );
}
