import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main className="px-safe flex flex-1 flex-col items-center justify-center pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-center">
      <div className="tricolour-rule fixed inset-x-0 top-[env(safe-area-inset-top)] z-10 h-1" aria-hidden />
      <BrandLogo size={96} className="size-24 ring-1 ring-gold/40" />
      <p className="mt-6 text-sm font-semibold tracking-[0.2em] text-saffron-ink uppercase">404</p>
      <h1 className="mt-1 font-display text-2xl font-bold tracking-wide text-navy">Page not found</h1>
      <p className="mt-2 max-w-xs text-muted-foreground">
        This page or event doesn’t exist, or it may have been deleted.
      </p>
      <Link href="/" className={buttonVariants({ className: "mt-6 h-12 px-6 text-base" })}>
        Back to events
      </Link>
    </main>
  );
}
