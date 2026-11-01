import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`text-plum font-serif font-semibold tracking-tight no-underline ${className}`}
      aria-label="Palater home"
    >
      pal<span className="text-terracotta">a</span>ter
    </Link>
  );
}
