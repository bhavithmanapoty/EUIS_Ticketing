import Link from "next/link";
import { ChevronLeft, LogOut } from "lucide-react";
import { logout } from "@/app/actions";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

export function AppHeader({
  title,
  eyebrow,
  backHref,
}: {
  title: React.ReactNode;
  /** Small label above the title, e.g. "Scan" or "Send". */
  eyebrow?: string;
  backHref?: string;
}) {
  return (
    <header className="pt-safe sticky top-0 z-10 bg-navy-deep text-white shadow-md shadow-navy-deep/20">
      <div className="px-safe mx-auto flex h-16 max-w-xl items-center gap-2">
        {backHref ? (
          <Link
            href={backHref}
            aria-label="Back"
            className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none active:bg-white/15"
          >
            <ChevronLeft className="size-6" />
          </Link>
        ) : (
          <Link
            href="/"
            aria-label="Home"
            className="-ml-0.5 flex shrink-0 items-center rounded-full focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
          >
            <BrandLogo size={36} className="ring-2 ring-gold" priority />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div className="text-[0.7rem] leading-tight font-semibold tracking-[0.14em] text-gold uppercase">
              {eyebrow}
            </div>
          )}
          <h1
            className={cn(
              "truncate font-display leading-tight font-semibold tracking-wide",
              eyebrow ? "text-base" : "text-lg"
            )}
          >
            {title}
          </h1>
        </div>
        <form action={logout} className="shrink-0">
          <button
            type="submit"
            className="-mr-2 flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none active:bg-white/15"
          >
            <LogOut className="size-4" /> Log out
          </button>
        </form>
      </div>
      <div className="tricolour-rule h-[3px]" aria-hidden />
    </header>
  );
}

export function PageBody({ children }: { children: React.ReactNode }) {
  return (
    <main className="px-safe mx-auto w-full max-w-xl flex-1 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {children}
    </main>
  );
}
