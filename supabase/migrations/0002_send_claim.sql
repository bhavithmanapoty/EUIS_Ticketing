-- Applied via the Supabase MCP (migration "send_claim").
-- A send request atomically claims a ticket before emailing it, so two
-- overlapping requests can't email the same person twice. Claims older than
-- 2 minutes are treated as abandoned (e.g. a crashed function) and can be retaken.
alter table public.tickets add column send_claimed_at timestamptz;
