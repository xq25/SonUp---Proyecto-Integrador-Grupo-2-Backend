-- =====================================================================
-- Migración 2026-11-08 · El actor de la auditoría pasa de uuid a texto (ADR-008)
--
-- Para BASES YA CREADAS con database/asisco_login_supabase.sql anterior
-- (p. ej. la BD de pruebas del módulo). Una base nueva no la necesita: el
-- script principal ya crea las columnas como texto.
--
-- Qué hace:
--   1. Redefine public.auditar() y public.borrado_logico() para guardar el
--      actor como texto (el `sub` del token del servicio de seguridad, p. ej. "20").
--   2. Redefine public.habilitar_auditoria() para que las tablas futuras
--      creen las columnas como texto.
--   3. Convierte creado_por / actualizado_por / eliminado_por de uuid a text
--      en TODAS las tablas de `public` que las tengan (los valores se conservan).
--
-- No borra ni cambia datos. Se puede ejecutar más de una vez.
-- Ejecutar en el SQL Editor de Supabase.
-- =====================================================================

begin;

create or replace function public.auditar()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_actor text := (select auth.uid())::text;
begin
  if tg_op = 'INSERT' then
    new.creado_en       := now();
    new.creado_por      := coalesce(v_actor, new.creado_por);
    new.actualizado_en  := new.creado_en;
    new.actualizado_por := new.creado_por;
    new.eliminado_en    := null;
    new.eliminado_por   := null;
    return new;
  end if;

  -- UPDATE: los datos de creación son inmutables.
  new.creado_en       := old.creado_en;
  new.creado_por      := old.creado_por;
  new.actualizado_en  := now();
  new.actualizado_por := coalesce(v_actor, new.actualizado_por);

  if old.eliminado_en is null and new.eliminado_en is not null then
    -- Borrado lógico.
    new.eliminado_en  := now();
    new.eliminado_por := coalesce(v_actor, new.eliminado_por, new.actualizado_por);
  elsif old.eliminado_en is not null and new.eliminado_en is null then
    -- Restauración.
    new.eliminado_por := null;
  else
    new.eliminado_en  := old.eliminado_en;
    new.eliminado_por := old.eliminado_por;
  end if;

  return new;
end;
$$;

create or replace function public.borrado_logico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_filtro text;
begin
  if current_setting('asisco.permitir_borrado_fisico', true) = 'on' then
    return old;
  end if;

  select string_agg(format('%1$I = ($1).%1$I', col), ' and ')
    into v_filtro
    from unnest(tg_argv) as col;

  execute format(
    'update %I.%I set eliminado_en = now(), eliminado_por = $2 where %s and eliminado_en is null',
    tg_table_schema, tg_table_name, v_filtro
  ) using old, (select auth.uid())::text;

  return null; -- cancela el DELETE físico
end;
$$;

-- Tablas futuras: columnas de auditoría como texto.
do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.habilitar_auditoria(text, text[])'::regprocedure) into v_def;
  if v_def like '%creado_por      uuid%' then
    execute replace(
      replace(
        replace(v_def, 'creado_por      uuid', 'creado_por      text'),
        'actualizado_por uuid', 'actualizado_por text'),
      'eliminado_por   uuid', 'eliminado_por   text');
  end if;
end;
$$;

-- Columnas existentes: uuid → text en todas las tablas auditadas de public.
do $$
declare
  r record;
begin
  for r in
    select table_name, column_name
      from information_schema.columns
     where table_schema = 'public'
       and column_name in ('creado_por', 'actualizado_por', 'eliminado_por')
       and data_type = 'uuid'
  loop
    execute format('alter table public.%I alter column %I type text using %I::text', r.table_name, r.column_name, r.column_name);
  end loop;
end;
$$;

commit;

-- Verificación: debe devolver 0 filas.
-- select table_name, column_name from information_schema.columns
--  where table_schema = 'public' and column_name in ('creado_por','actualizado_por','eliminado_por') and data_type = 'uuid';
