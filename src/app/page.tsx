import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AppHeader, PageBody } from "@/components/app-header";
import { NewEventForm } from "@/components/new-event-form";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatEventDate } from "@/lib/format";
import type { EventRecord } from "@/lib/types";

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
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Events</h2>
        {error && <p className="text-destructive">Could not load events: {error.message}</p>}
        {!error && events.length === 0 && (
          <p className="mb-4 text-muted-foreground">No events yet. Create one below.</p>
        )}
        <ul className="mb-6 grid gap-2">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/events/${e.id}`}>
                <Card className="flex-row items-center gap-3 px-4 py-4 hover:bg-muted">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{e.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatEventDate(e.event_date)}
                    </div>
                  </div>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
        <NewEventForm />
      </PageBody>
    </>
  );
}
