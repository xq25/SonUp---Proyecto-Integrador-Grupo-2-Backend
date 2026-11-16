-- =====================================================================
-- 2026-11-16 · Objetivo de la sesión (ADR-009)
-- Agrega `objective` (opcional, máx. 1000) a `workshop_sessions` en las BD que
-- ya tienen la tabla de sesiones. Las BD nuevas lo traen desde
-- database/asisco_login_supabase.sql. Se puede ejecutar varias veces.
-- =====================================================================

alter table public.workshop_sessions
  add column if not exists objective text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workshop_sessions_objective_check'
  ) then
    alter table public.workshop_sessions
      add constraint workshop_sessions_objective_check
      check (char_length(objective) between 1 and 1000);
  end if;
end;
$$;
