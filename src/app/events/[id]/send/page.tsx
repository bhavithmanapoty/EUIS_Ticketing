import { cache } from "react";
import type { Metadata } from "next";
import { AppHeader, PageBody } from "@/components/app-header";
import { SendTickets } from "@/components/send-tickets";
import { getEventOr404 } from "@/lib/events";

const loadEvent = cache(getEventOr404);

export async function generateMetadata({
  params,
}: PageProps<"/events/[id]/send">): Promise<Metadata> {
  const { event } = await loadEvent((await params).id);
  return { title: `Send · ${event.name}` };
}

export default async function SendPage({ params }: PageProps<"/events/[id]/send">) {
  const { id } = await params;
  const { event } = await loadEvent(id);

  return (
    <>
      <AppHeader eyebrow="Send" title={event.name} backHref={`/events/${id}`} />
      <PageBody>
        <SendTickets eventId={id} eventName={event.name} />
      </PageBody>
    </>
  );
}
