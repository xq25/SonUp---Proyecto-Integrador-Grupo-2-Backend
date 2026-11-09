-- =====================================================================
-- Migración 2026-11-09 · Tipo de evidencia: IMAGE | VIDEO
--
-- Para BASES YA CREADAS con database/asisco_login_supabase.sql anterior
-- (p. ej. la BD de pruebas del módulo). Una base nueva no la necesita: el
-- script principal ya crea la columna.
--
-- Qué hace:
--   1. Agrega public.evidences.type (texto).
--   2. Completa las evidencias existentes según la extensión de su URL:
--      .mp4, .webm, .mov, .m4v, .ogv, .avi, .mkv → VIDEO; cualquier otra → IMAGE.
--      Revisar después las que no tengan extensión clara.
--   3. La deja obligatoria y con el check IMAGE | VIDEO.
--
-- No borra datos. Se puede ejecutar más de una vez.
-- Ejecutar en el SQL Editor de Supabase.
-- =====================================================================

begin;

alter table public.evidences add column if not exists type text;

update public.evidences
   set type = case
     when url ~* '\.(mp4|webm|mov|m4v|ogv|avi|mkv)([?#].*)?$' then 'VIDEO'
     else 'IMAGE'
   end
 where type is null;

alter table public.evidences alter column type set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.evidences'::regclass and conname = 'evidences_type_check'
  ) then
    alter table public.evidences
      add constraint evidences_type_check check (type in ('IMAGE', 'VIDEO'));
  end if;
end;
$$;

commit;

-- Verificación: cuántas evidencias hay de cada tipo.
-- select type, count(*) from public.evidences group by type;
