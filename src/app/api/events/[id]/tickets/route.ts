import { NextResponse } from "next/server";
import { getAuthedClient } from "@/lib/supabase/server";
import {
  computeNewRows,
  countByStudent,
  normaliseRow,
  validateRows,
  type ExistingTicket,
  type TicketRow,
} from "@/lib/tickets";
import { isUuid } from "@/lib/types";

type Supabase = NonNullable<Awaited<ReturnType<typeof getAuthedClient>>>;

/** All tickets already issued for an event (paged past the 1000-row API cap). */
async function existingTickets(supabase: Supabase, eventId: string): Promise<ExistingTicket[]> {
  const PAGE = 1000;
  const tickets: ExistingTicket[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("tickets")
      .select("student_id, email")
      .eq("event_id", eventId)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    tickets.push(...data.map((t) => ({ studentId: t.student_id, email: t.email })));
    if (data.length < PAGE) return tickets;
  }
}

/** Data needed for the upload preview: existing tickets (for dedup + warnings). */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/events/[id]/tickets">
) {
  const supabase = await getAuthedClient();
  if (!supabase) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [existing, unsent, recent] = await Promise.all([
    existingTickets(supabase, id).then(
      (data) => ({ data, error: null }),
      (e: Error) => ({ data: null, error: e })
    ),
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("event_id", id)
      .is("email_sent_at", null),
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .gte("email_sent_at", since),
  ]);
  const error = existing.error ?? unsent.error ?? recent.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    existing: existing.data ?? [],
    unsentCount: unsent.count ?? 0,
    sentLast24h: recent.count ?? 0,
  });
}

/** Inserts the new (deduplicated) tickets and returns every unsent ticket id. */
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/events/[id]/tickets">
) {
  const supabase = await getAuthedClient();
  if (!supabase) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { rows?: TicketRow[] } | null;
  const rows = Array.isArray(body?.rows) ? body.rows : null;
  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "No rows" }, { status: 400 });
  }
  const clean: TicketRow[] = rows.map(normaliseRow);
  const errors = validateRows(clean);
  if (errors.length) {
    return NextResponse.json({ error: "Invalid rows", errors }, { status: 400 });
  }

  const { data: event } = await supabase.from("events").select("id").eq("id", id).maybeSingle();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  let existing: ExistingTicket[];
  try {
    existing = await existingTickets(supabase, id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const newRows = computeNewRows(clean, countByStudent(existing.map((t) => t.studentId)));
  if (newRows.length) {
    const { error } = await supabase.from("tickets").insert(
      newRows.map((r) => ({
        event_id: id,
        student_id: r.studentId,
        name: r.name,
        email: r.email,
        dietary_requirements: r.dietaryRequirements || null,
        membership: r.membership || null,
        ticket_type: r.ticketType || null,
      }))
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const unsent: { id: string; name: string; email: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("tickets")
      .select("id, name, email")
      .eq("event_id", id)
      .is("email_sent_at", null)
      .order("created_at")
      .order("id")
      .range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    unsent.push(...data);
    if (data.length < 1000) break;
  }

  return NextResponse.json({ created: newRows.length, unsent });
}
