import { NextResponse } from "next/server";
import { getAuthedClient } from "@/lib/supabase/server";
import { decryptTicketId } from "@/lib/qr-crypto";
import { isUuid, toAttendee, type TicketRecord, type VerifyResult } from "@/lib/types";

/** Decrypts a scanned QR token and reports the ticket's status. Read-only. */
export async function POST(req: Request) {
  const supabase = await getAuthedClient();
  if (!supabase) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { token?: string; eventId?: string }
    | null;
  const token = String(body?.token ?? "");
  const eventId = String(body?.eventId ?? "");

  if (!isUuid(eventId)) return NextResponse.json({ error: "Bad event id" }, { status: 400 });

  const ticketId = token.length < 200 ? decryptTicketId(token) : null;
  if (!ticketId) return NextResponse.json<VerifyResult>({ status: "INVALID" });

  const { data, error } = await supabase
    .from("tickets")
    .select("*, events(name)")
    .eq("id", ticketId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json<VerifyResult>({ status: "INVALID" });

  const ticket = data as TicketRecord & { events: { name: string } | null };
  const attendee = toAttendee(ticket);

  if (ticket.event_id !== eventId) {
    return NextResponse.json<VerifyResult>({
      status: "WRONG_EVENT",
      eventName: ticket.events?.name ?? "another event",
      attendee,
    });
  }
  if (ticket.checked_in_at) {
    return NextResponse.json<VerifyResult>({
      status: "ALREADY_CHECKED_IN",
      checkedInAt: ticket.checked_in_at,
      attendee,
    });
  }
  return NextResponse.json<VerifyResult>({ status: "VALID", attendee });
}
