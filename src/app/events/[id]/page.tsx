import Link from "next/link";
import { Mail, ScanLine } from "lucide-react";
import { AppHeader, PageBody } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { getEventOr404 } from "@/lib/events";
import { formatEventDate } from "@/lib/format";

export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const { supabase, event } = await getEventOr404(id);

  const tickets = () =>
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("event_id", id);
  const [total, sent, checkedIn, failed] = (
    await Promise.all([
      tickets(),
      tickets().not("email_sent_at", "is", null),
      tickets().not("checked_in_at", "is", null),
      tickets().is("email_sent_at", null).not("email_error", "is", null),
    ])
  ).map((r) => r.count ?? 0);

  return (
    <>
      <AppHeader title={event.name} backHref="/" />
      <PageBody>
        <p className="mb-4 text-muted-foreground">{formatEventDate(event.event_date)}</p>

        <div className="mb-6 grid grid-cols-3 gap-2 text-center">
          <Stat label="Tickets" value={total} />
          <Stat label="Emailed" value={sent} />
          <Stat label="Checked in" value={checkedIn} />
        </div>
        {failed > 0 && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {failed} email{failed === 1 ? "" : "s"} failed to send. Re-upload the sheet on
            “Send tickets” to retry them.
          </p>
        )}

        <div className="grid gap-3">
          <BigLink href={`/events/${id}/scan`} icon={<ScanLine className="size-7" />}
            title="Scan tickets" subtitle="Check people in at the door" />
          <BigLink href={`/events/${id}/send`} icon={<Mail className="size-7" />}
            title="Send tickets" subtitle="Upload the Excel sheet and email QR codes" />
        </div>
      </PageBody>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="gap-1 px-2 py-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Card>
  );
}

function BigLink(props: { href: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Link href={props.href}>
      <Card className="flex-row items-center gap-4 px-5 py-6 hover:bg-muted">
        {props.icon}
        <div>
          <div className="text-lg font-semibold">{props.title}</div>
          <div className="text-sm text-muted-foreground">{props.subtitle}</div>
        </div>
      </Card>
    </Link>
  );
}
