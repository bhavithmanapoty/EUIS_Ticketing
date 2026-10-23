import Link from "next/link";
import { ChevronLeft, LogOut } from "lucide-react";
import { logout } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function AppHeader({ title, backHref }: { title: string; backHref?: string }) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-4">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Back"
            className="-ml-2 flex size-10 items-center justify-center rounded-lg hover:bg-muted"
          >
            <ChevronLeft className="size-5" />
          </Link>
        )}
        <h1 className="flex-1 truncate text-base font-semibold">{title}</h1>
        <form action={logout}>
          <Button type="submit" variant="ghost" size="lg" className="h-10">
            <LogOut /> Log out
          </Button>
        </form>
      </div>
    </header>
  );
}

export function PageBody({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-xl flex-1 px-4 py-4">{children}</main>;
}
