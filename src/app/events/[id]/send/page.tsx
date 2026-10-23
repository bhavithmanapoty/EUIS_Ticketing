import { AppHeader, PageBody } from "@/components/app-header";
import { SendTickets } from "@/components/send-tickets";
import { getEventOr404 } from "@/lib/events";

export default async function SendPage({ params }: PageProps<"/events/[id]/send">) {
  const { id } = await params;
  const { event } = await getEventOr404(id);

  return (
    <>
      <AppHeader title={`Send · ${event.name}`} backHref={`/events/${id}`} />
      <PageBody>
        <SendTickets eventId={id} eventName={event.name} />
      </PageBody>
    </>
  );
}
