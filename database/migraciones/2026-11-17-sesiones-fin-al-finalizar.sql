-- =====================================================================
-- 2026-11-17 · El fin de una sesión se guarda al finalizarla (ADR-009)
-- `workshop_sessions.ends_at` deja de ser obligatorio: las sesiones programadas
-- y en curso no tienen fin; solo las finalizadas (fin real).
-- Para las BD que ya tienen la tabla de sesiones; las nuevas lo traen desde
-- database/asisco_login_supabase.sql. Se puede ejecutar varias veces.
-- =====================================================================

begin;

alter table public.workshop_sessions
  alter column ends_at drop not null;

-- El fin previsto de las sesiones que aún no han finalizado se descarta.
update public.workshop_sessions
   set ends_at = null
 where status <> 'finished' and ends_at is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workshop_sessions_ends_at_finished'
  ) then
    alter table public.workshop_sessions
      add constraint workshop_sessions_ends_at_finished
      check ((status = 'finished') = (ends_at is not null));
  end if;
end;
$$;

-- Dos sesiones vigentes de un taller no empiezan a la misma hora.
create unique index if not exists workshop_sessions_start_key
  on public.workshop_sessions (workshop_id, starts_at)
  where eliminado_en is null;

commit;
