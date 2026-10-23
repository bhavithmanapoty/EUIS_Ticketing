import { cache } from "react";
import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { TicketScanner } from "@/components/ticket-scanner";
import { getEventOr404 } from "@/lib/events";

const loadEvent = cache(getEventOr404);

export async function generateMetadata({
  params,
}: PageProps<"/events/[id]/scan">): Promise<Metadata> {
  const { event } = await loadEvent((await params).id);
  return { title: `Scan · ${event.name}` };
}

export default async function ScanPage({ params }: PageProps<"/events/[id]/scan">) {
  const { id } = await params;
  const { event } = await loadEvent(id);

  return (
    <>
      <AppHeader eyebrow="Scan" title={event.name} backHref={`/events/${id}`} />
      <TicketScanner eventId={id} />
    </>
  );
}
