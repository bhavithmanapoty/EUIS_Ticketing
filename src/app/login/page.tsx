"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { login } from "@/app/actions";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <main className="px-safe relative flex flex-1 flex-col items-center justify-center overflow-hidden pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="tricolour-rule fixed inset-x-0 top-[env(safe-area-inset-top)] z-10 h-1" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,var(--gold-soft),transparent_70%)]"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandLogo
            size={128}
            priority
            className="size-28 shadow-lg ring-1 shadow-gold/20 ring-gold/40 sm:size-32"
          />
          <h1 className="mt-4 font-display text-2xl font-bold tracking-wide text-navy">
            EUIS Tickets
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Edinburgh University Indian Society</p>
        </div>
        <Card className="shadow-sm">
          <CardContent>
            <form action={action} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="h-12 text-base"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="h-12 text-base"
                />
              </div>
              {state?.error && (
                <p
                  className="rounded-lg bg-destructive/8 px-3 py-2 text-sm font-medium text-destructive"
                  role="alert"
                >
                  {state.error}
                </p>
              )}
              <Button type="submit" disabled={pending} className="mt-1 h-12 text-base">
                {pending && <Loader2 className="animate-spin" />}
                {pending ? "Logging in…" : "Log in"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">Committee access only</p>
      </div>
    </main>
  );
}
