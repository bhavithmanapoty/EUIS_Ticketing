import { NextResponse } from "next/server";
import { getAuthedClient } from "@/lib/supabase/server";
import { createMailer, sendTicketEmail } from "@/lib/email";
import { encryptTicketId } from "@/lib/qr-crypto";
import { isUuid } from "@/lib/types";

export const maxDuration = 60;

const MAX_BATCH = 10;
const CLAIM_TIMEOUT_MS = 2 * 60 * 1000;

type SendResult = { id: string; ok: boolean; error?: string };

/** Sends ticket emails for a small batch of ticket ids. */
export async function POST(req: Request) {
  const supabase = await getAuthedClient();
  if (!supabase) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { ticketIds?: string[] } | null;
  const ids = Array.isArray(body?.ticketIds) ? body.ticketIds.map(String) : [];
  if (ids.length === 0 || ids.length > MAX_BATCH || !ids.every(isUuid)) {
    return NextResponse.json({ error: `Send 1-${MAX_BATCH} ticket ids` }, { status: 400 });
  }

  const { data: tickets, error } = await supabase
    .from("tickets")
    .select("id, name, email, email_sent_at, events(name)")
    .in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let mailer;
  try {
    mailer = createMailer();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const results: SendResult[] = [];
  try {
    for (const id of ids) {
      const t = tickets.find((x) => x.id === id);
      if (!t) {
        results.push({ id, ok: false, error: "Ticket not found" });
        continue;
      }
      if (t.email_sent_at) {
        results.push({ id, ok: true }); // already sent; don't email twice
        continue;
      }
      // Atomically claim the ticket so an overlapping request (double tap,
      // second tab, quick re-upload) can't email the same person twice.
      const staleBefore = new Date(Date.now() - CLAIM_TIMEOUT_MS).toISOString();
      const { data: claimed, error: claimError } = await supabase
        .from("tickets")
        .update({ send_claimed_at: new Date().toISOString() })
        .eq("id", id)
        .is("email_sent_at", null)
        .or(`send_claimed_at.is.null,send_claimed_at.lt.${staleBefore}`)
        .select("id")
        .maybeSingle();
      if (claimError) {
        results.push({ id, ok: false, error: claimError.message });
        continue;
      }
      if (!claimed) {
        results.push({ id, ok: false, error: "Already being sent by another request" });
        continue;
      }
      const event = Array.isArray(t.events) ? t.events[0] : t.events;
      try {
        await sendTicketEmail(mailer, {
          to: t.email,
          name: t.name,
          eventName: event?.name ?? "event",
          token: encryptTicketId(t.id),
        });
      } catch (e) {
        const message = (e as Error).message.slice(0, 500);
        await supabase
          .from("tickets")
          .update({ email_error: message, send_claimed_at: null })
          .eq("id", id);
        results.push({ id, ok: false, error: message });
        continue;
      }
      // The email is out. If recording that fails, report it but keep the
      // claim as-is so a quick retry can't email a second copy.
      const { error: markError } = await supabase
        .from("tickets")
        .update({ email_sent_at: new Date().toISOString(), email_error: null, send_claimed_at: null })
        .eq("id", id);
      results.push(
        markError
          ? { id, ok: true, error: `Sent, but status not saved: ${markError.message}` }
          : { id, ok: true }
      );
    }
  } finally {
    mailer.close();
  }

  return NextResponse.json({ results });
}
