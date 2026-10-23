import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { AppHeader, PageBody } from "@/components/app-header";
import { NewEventForm } from "@/components/new-event-form";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatEventDate } from "@/lib/format";
import type { EventRecord } from "@/lib/types";

// The root title template only applies to child segments, so spell it out here.
export const metadata: Metadata = { title: { absolute: "Events · EUIS Tickets" } };

/** Day number and short month for the calendar tile, from a YYYY-MM-DD date. */
function dateTile(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return {
    day: d.toLocaleDateString("en-GB", { day: "numeric", timeZone: "UTC" }),
    month: d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
  };
}

export default async function HomePage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: false });
  const events = (data ?? []) as EventRecord[];

  return (
    <>
      <AppHeader title="EUIS Tickets" />
      <PageBody>
        <h2 className="mb-3 font-display text-xl font-semibold tracking-wide text-navy">Events</h2>
        {error && (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            Could not load events: {error.message}
          </p>
        )}
        {!error && events.length === 0 && (
          <Card className="mb-6 items-center gap-2 border-dashed px-4 py-8 text-center">
            <CalendarDays className="size-8 text-gold" />
            <p className="text-muted-foreground">No events yet. Create one below.</p>
          </Card>
        )}
        {events.length > 0 && (
          <ul className="mb-8 grid grid-cols-1 gap-2.5">
            {events.map((e) => {
              const tile = dateTile(e.event_date);
              return (
                <li key={e.id}>
                  <Link
                    href={`/events/${e.id}`}
                    className="group block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <Card className="min-h-18 flex-row items-center gap-3.5 px-3.5 py-3 transition-colors group-hover:bg-gold-soft/40 group-active:bg-gold-soft/60">
                      {tile && (
                        <div
                          aria-hidden
                          className="flex size-12 shrink-0 flex-col items-center justify-center rounded-lg border border-gold/50 bg-gold-soft leading-none text-navy"
                        >
                          <span className="text-lg font-bold tabular-nums">{tile.day}</span>
                          <span className="mt-0.5 text-[0.65rem] font-semibold tracking-wider text-saffron-ink uppercase">
                            {tile.month}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-base font-semibold">{e.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatEventDate(e.event_date)}
                        </div>
                      </div>
                      <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <NewEventForm />
      </PageBody>
    </>
  );
}
