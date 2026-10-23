-- Applied via the Supabase MCP (migration "ticket_type").
-- Optional "Ticket Type" spreadsheet column; null when absent or blank.
alter table public.tickets add column ticket_type text;
