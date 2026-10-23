-- Applied via the Supabase MCP (migration "optional_diet_membership").
-- Dietary requirements and Membership are optional per row (null = not shown).
alter table public.tickets alter column dietary_requirements drop not null;
alter table public.tickets alter column membership drop not null;
