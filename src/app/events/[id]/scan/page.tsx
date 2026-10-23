import { AppHeader } from "@/components/app-header";
import { TicketScanner } from "@/components/ticket-scanner";
import { getEventOr404 } from "@/lib/events";

export default async function ScanPage({ params }: PageProps<"/events/[id]/scan">) {
  const { id } = await params;
  const { event } = await getEventOr404(id);

  return (
    <>
      <AppHeader title={`Scan · ${event.name}`} backHref={`/events/${id}`} />
      <TicketScanner eventId={id} />
    </>
  );
}
