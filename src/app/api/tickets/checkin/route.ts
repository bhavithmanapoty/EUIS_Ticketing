import { NextResponse } from "next/server";
import { getAuthedClient } from "@/lib/supabase/server";
import { isUuid, toAttendee, type TicketRecord, type VerifyResult } from "@/lib/types";

/**
 * Checks a ticket in. The `checked_in_at is null` filter makes this atomic:
 * if two phones confirm the same ticket at once, only one update succeeds.
 */
export async function POST(req: Request) {
  const supabase = await getAuthedClient();
  if (!supabase) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { ticketId?: string; eventId?: string }
    | null;
  const ticketId = String(body?.ticketId ?? "");
  const eventId = String(body?.eventId ?? "");
  if (!isUuid(ticketId) || !isUuid(eventId)) {
    return NextResponse.json({ error: "Bad ticket or event id" }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("tickets")
    .update({ checked_in_at: new Date().toISOString() })
    .eq("id", ticketId)
    .eq("event_id", eventId)
    .is("checked_in_at", null)
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (updated) {
    const t = updated as TicketRecord;
    return NextResponse.json<VerifyResult>({
      status: "CHECKED_IN",
      checkedInAt: t.checked_in_at!,
      attendee: toAttendee(t),
    });
  }

  // Nothing updated: someone else checked it in first (or it doesn't exist).
  const { data: existing } = await supabase
    .from("tickets")
    .select()
    .eq("id", ticketId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (existing?.checked_in_at) {
    return NextResponse.json<VerifyResult>({
      status: "ALREADY_CHECKED_IN",
      checkedInAt: existing.checked_in_at,
      attendee: toAttendee(existing as TicketRecord),
    });
  }
  return NextResponse.json<VerifyResult>({ status: "INVALID" });
}
