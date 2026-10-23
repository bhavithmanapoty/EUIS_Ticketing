import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, CalendarDays, ChevronRight, Mail, ScanLine } from "lucide-react";
import { AppHeader, PageBody } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { getEventOr404 } from "@/lib/events";
import { formatEventDate } from "@/lib/format";
import { cn } from "@/lib/utils";

// Deduped per request, so the tab title doesn't cost a second query.
const loadEvent = cache(getEventOr404);

export async function generateMetadata({ params }: PageProps<"/events/[id]">): Promise<Metadata> {
  const { event } = await loadEvent((await params).id);
  return { title: event.name };
}

export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const { supabase, event } = await loadEvent(id);

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
        <p className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CalendarDays className="size-4 text-saffron-ink" />
          {formatEventDate(event.event_date)}
        </p>

        <div className="mb-5 grid grid-cols-3 gap-2.5 text-center">
          <Stat label="Tickets" value={total} accent="bg-navy" />
          <Stat label="Emailed" value={sent} accent="bg-saffron" />
          <Stat label="Checked in" value={checkedIn} accent="bg-india-green" />
        </div>
        {failed > 0 && (
          <p className="mb-5 flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-900">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-700" />
            <span>
              {failed} email{failed === 1 ? "" : "s"} failed to send. Re-upload the sheet on
              “Send tickets” to retry them.
            </span>
          </p>
        )}

        <div className="grid grid-cols-1 gap-3">
          <BigLink
            href={`/events/${id}/scan`}
            icon={<ScanLine className="size-7" />}
            title="Scan tickets"
            subtitle="Check people in at the door"
            primary
          />
          <BigLink
            href={`/events/${id}/send`}
            icon={<Mail className="size-7" />}
            title="Send tickets"
            subtitle="Upload the Excel sheet and email QR codes"
          />
        </div>
      </PageBody>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <Card className="relative gap-0.5 px-1.5 pt-4 pb-3">
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1", accent)} />
      <div className="text-[1.75rem] leading-none font-bold text-navy tabular-nums">{value}</div>
      <div className="mt-1 text-xs font-medium text-muted-foreground">{label}</div>
    </Card>
  );
}

function BigLink(props: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={props.href}
      className={cn(
        "group flex items-center gap-4 rounded-2xl px-4 py-5 shadow-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        props.primary
          ? "bg-navy text-white hover:bg-navy/95 active:bg-navy-deep"
          : "bg-card ring-1 ring-border hover:bg-gold-soft/40 active:bg-gold-soft/60"
      )}
    >
      <span
        className={cn(
          "flex size-14 shrink-0 items-center justify-center rounded-xl",
          props.primary ? "bg-white/12 text-gold" : "bg-gold-soft text-saffron-ink"
        )}
      >
        {props.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold">{props.title}</span>
        <span
          className={cn(
            "block text-sm",
            props.primary ? "text-white/80" : "text-muted-foreground"
          )}
        >
          {props.subtitle}
        </span>
      </span>
      <ChevronRight
        className={cn(
          "size-5 shrink-0 transition-transform group-hover:translate-x-0.5",
          props.primary ? "text-white/70" : "text-muted-foreground"
        )}
      />
    </Link>
  );
}
