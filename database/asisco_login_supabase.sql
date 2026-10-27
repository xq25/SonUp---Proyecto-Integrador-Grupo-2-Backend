-- =====================================================================
-- ASISCO UP · Módulo de seguimiento y desarrollo de estudiantes
-- Esquema para Supabase: acceso (login y roles) + talleres, habilidades,
-- evidencias y administrativos.
-- Las contraseñas, sesiones y tokens los maneja Supabase Auth (auth.users).
-- Ejecutar en el SQL Editor de Supabase, en la base de datos del grupo.
--
-- Datos de otros módulos (NO se crean aquí; solo se leen):
--   administrativo.children            → estudiantes (student_id)
--   administrativo.guardians           → acudientes
--   administrativo.children_guardians  → vínculo estudiante–acudiente
--   administrativo.professionals       → talleristas (evaluator_id)
-- Las columnas que los referencian son bigint SIN FK física: el otro módulo
-- es dueño de esas tablas; la existencia se valida en la capa de aplicación.
--
-- Convenciones:
--   · Tablas de acceso (heredadas del script de login) en español; tablas
--     nuevas del módulo en inglés, como el diagrama del módulo.
--   · Auditoría en todas las tablas (creado_en/por, actualizado_en/por,
--     eliminado_en/por), mantenida por el trigger public.auditar().
--   · Borrado lógico: ninguna FK borra en cascada (on delete restrict) y
--     todo DELETE se convierte en "eliminado_en = now()".
--   · Los valores de `status` de las tablas nuevas son PROVISIONALES.
-- =====================================================================

-- 0. Auditoría y borrado lógico ----------------------------------------
-- *_por guarda el id del perfil (= auth.users.id) que hizo la operación.
-- Desde Supabase (PostgREST) se toma de auth.uid(); desde el backend
-- (Prisma, conexión sin JWT) el backend debe enviarlo explícitamente.
-- Las fechas siempre las pone la base de datos.

create function public.auditar()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
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

-- Convierte cada DELETE en un borrado lógico. Recibe como argumentos las
-- columnas de la llave primaria. Es security definer para poder escribir
-- eliminado_en/por, pero solo recibe filas que ya pasaron la política RLS
-- de DELETE del usuario.
-- Purga real (p. ej. supresión por Ley 1581): en una transacción,
--   set local asisco.permitir_borrado_fisico = 'on'; delete ...;
create function public.borrado_logico()
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
  ) using old, (select auth.uid());

  return null; -- cancela el DELETE físico
end;
$$;

-- Agrega las columnas de auditoría y los dos triggers a una tabla.
create function public.habilitar_auditoria(p_tabla text, variadic p_pk text[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format(
    'alter table public.%I
       add column creado_en       timestamptz not null default now(),
       add column creado_por      uuid,
       add column actualizado_en  timestamptz not null default now(),
       add column actualizado_por uuid,
       add column eliminado_en    timestamptz,
       add column eliminado_por   uuid',
    p_tabla
  );

  execute format(
    'create trigger auditar before insert or update on public.%I
       for each row execute function public.auditar()',
    p_tabla
  );

  execute format(
    'create trigger borrado_logico before delete on public.%I
       for each row execute function public.borrado_logico(%s)',
    p_tabla,
    (select string_agg(quote_literal(c), ', ') from unnest(p_pk) as c)
  );
end;
$$;

-- =====================================================================
-- ACCESO (login, roles y permisos)
-- =====================================================================

-- 1. Catálogos ---------------------------------------------------------

create table public.aplicaciones (
  codigo text primary key,
  nombre text not null
);
select public.habilitar_auditoria('aplicaciones', 'codigo');

-- Cada grupo deja solo las aplicaciones que comparten su base de datos.
insert into public.aplicaciones (codigo, nombre) values
  ('saga_up', 'SAGA-UP'),
  ('son_up', 'SON UP'),
  ('aula_up', 'Aula UP'),
  ('metodo_consuelo', 'Método Consuelo'),
  ('asisco_pay', 'Asisco Pay'),
  ('upnews', 'UpNews'),
  ('asisConnection', 'AsisConnection'),
  ('gameUp', 'GameUp');

create table public.roles (
  codigo text primary key,
  nombre text not null
);
select public.habilitar_auditoria('roles', 'codigo');

insert into public.roles (codigo, nombre) values
  ('administrador', 'Administración de la fundación'),
  ('directora', 'Directora'),
  ('docente', 'Docente o terapeuta'),
  ('tallerista', 'Tallerista'),
  ('acudiente', 'Acudiente'),
  ('padrino', 'Padrino o donante'),
  ('estudiante', 'Estudiante o joven'),
  ('comunicaciones', 'Equipo de comunicaciones');

-- 2. Perfil de cada cuenta (1 a 1 con auth.users) ----------------------
-- on delete restrict: una cuenta con perfil no se borra físicamente;
-- se desactiva con borrado lógico del perfil (y baneo/soft delete en Auth).

create table public.perfiles (
  id uuid primary key references auth.users (id) on delete restrict,
  nombres text not null default '',
  apellidos text,
  celular text,
  tipo_documento text,
  numero_documento text unique,
  estado text not null default 'activo'
    check (estado in ('activo', 'inactivo', 'bloqueado')),
  acepto_tratamiento_datos_en timestamptz
);
select public.habilitar_auditoria('perfiles', 'id');

-- 3. Roles por usuario y por aplicación --------------------------------
-- aplicacion = null significa que el rol aplica en todas las apps del grupo.
-- Un rol revocado queda con eliminado_en; si se vuelve a asignar se
-- restaura la misma fila (por eso la restricción unique no es parcial).

create table public.usuario_roles (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfiles (id) on delete restrict,
  rol text not null references public.roles (codigo) on delete restrict,
  aplicacion text references public.aplicaciones (codigo) on delete restrict,
  asignado_por uuid references public.perfiles (id) on delete restrict,
  unique nulls not distinct (usuario_id, rol, aplicacion)
);
select public.habilitar_auditoria('usuario_roles', 'id');

-- 4. Crear el perfil automáticamente al registrarse --------------------
-- El rol NO se toma de los metadatos del registro: lo asigna la administración.

create function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombres, apellidos, celular, creado_por)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombres', ''),
    new.raw_user_meta_data ->> 'apellidos',
    new.raw_user_meta_data ->> 'celular',
    new.id -- el perfil lo crea el propio usuario al registrarse
  );
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- 5. Función de apoyo para las políticas -------------------------------

create function public.tiene_rol(p_rol text, p_app text default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.usuario_roles ur
    join public.perfiles p on p.id = ur.usuario_id
    where ur.usuario_id = (select auth.uid())
      and ur.rol = p_rol
      and (ur.aplicacion is null or p_app is null or ur.aplicacion = p_app)
      and ur.eliminado_en is null
      and p.eliminado_en is null
      and p.estado = 'activo'
  );
$$;

-- =====================================================================
-- ADMINISTRATIVOS (PROVISIONAL)
-- Actor que no se había contemplado. Tabla mínima y aislada para poder
-- reemplazarla (p. ej. por datos del módulo administrativo) sin afectar
-- el resto. Sin enlace a cuentas (decisión de diseño: no se usa profile_id).
-- =====================================================================

create table public.administrators (
  id bigint generated always as identity primary key,
  full_name text not null
    check (char_length(full_name) between 3 and 150),
  document_type text not null
    check (document_type in ('CC', 'TI', 'CE', 'PA', 'RC', 'PPT', 'NIT')),
  document_number text not null unique
    check (document_number ~ '^[A-Za-z0-9-]{3,20}$'),
  -- Se guarda en minúsculas: así el unique no distingue mayúsculas.
  email text not null unique
    check (email = lower(email) and char_length(email) <= 254),
  phone text,
  position text not null
    check (char_length(position) between 2 and 100),
  status text not null default 'active'
    check (status in ('active', 'inactive'))
);
select public.habilitar_auditoria('administrators', 'id');

-- =====================================================================
-- HABILIDADES
-- =====================================================================

create table public.skill_categories (
  id bigint generated always as identity primary key,
  -- Sin espacios sobrantes (ni al inicio/fin ni dobles).
  name text not null
    check (char_length(name) between 2 and 100 and name = btrim(name) and name !~ '\s{2,}'),
  description text
    check (char_length(description) between 1 and 500)
);
select public.habilitar_auditoria('skill_categories', 'id');
-- Único sin distinguir mayúsculas ("Blandas" = "blandas").
create unique index skill_categories_name_key on public.skill_categories (lower(name));

create table public.skills (
  id bigint generated always as identity primary key,
  -- Sin espacios sobrantes (ni al inicio/fin ni dobles).
  name text not null
    check (char_length(name) between 2 and 100 and name = btrim(name) and name !~ '\s{2,}'),
  skill_category_id bigint not null references public.skill_categories (id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'inactive'))
);
select public.habilitar_auditoria('skills', 'id');
-- Único por categoría y sin distinguir mayúsculas: el mismo nombre puede
-- existir en categorías distintas.
create unique index skills_category_name_key on public.skills (skill_category_id, lower(name));

-- Escala de calificación (p. ej. "en proceso", "logrado").
--   num_value: valor numérico de la calificación. Define el orden de las
--              escalas y es el valor que se promedia.
--   min_value / max_value: intervalo (inclusivo) de promedios que se
--              clasifican en esta escala.
-- Todos los valores están en el rango global de calificación 0–5.
-- Entre escalas activas: los intervalos no se solapan y num_value es único.
create table public.evaluation_scales (
  id bigint generated always as identity primary key,
  code text not null unique
    check (code ~ '^[A-Z0-9_]{1,30}$'), -- solo mayúsculas, números y _
  name text not null
    check (char_length(name) between 2 and 100 and name = btrim(name) and name !~ '\s{2,}'),
  description text
    check (char_length(description) between 1 and 500),
  num_value numeric(5, 2) not null check (num_value between 0 and 5),
  min_value numeric(5, 2) not null check (min_value between 0 and 5),
  max_value numeric(5, 2) not null check (max_value between 0 and 5),
  is_active boolean not null default true,
  check (min_value <= max_value),
  check (num_value between min_value and max_value)
);
select public.habilitar_auditoria('evaluation_scales', 'id');
create unique index evaluation_scales_name_key on public.evaluation_scales (lower(name));
-- "Vigente" = activa y no eliminada (eliminado_en lo agrega habilitar_auditoria).
-- Intervalos de escalas vigentes sin solapamiento: cada promedio cae en una sola escala.
alter table public.evaluation_scales
  add constraint evaluation_scales_no_overlap
  exclude using gist (numrange(min_value, max_value, '[]') with &&)
  where (is_active and eliminado_en is null);
-- Implícito en el no solapamiento (num_value está dentro de su intervalo); se deja explícito.
create unique index evaluation_scales_active_num_value_key on public.evaluation_scales (num_value)
  where is_active and eliminado_en is null;

-- Nivel de una habilidad en un estudiante, expresado como una escala de
-- calificación (diagrama: UserSkills).
create table public.student_skills (
  id bigint generated always as identity primary key,
  student_id bigint not null, -- administrativo.children.child_id
  skill_id bigint not null references public.skills (id) on delete restrict,
  evaluation_scale_id bigint not null references public.evaluation_scales (id) on delete restrict,
  unique (student_id, skill_id)
);
select public.habilitar_auditoria('student_skills', 'id');

-- =====================================================================
-- TALLERES
-- =====================================================================

-- Ciclo de vida: planned → active → finished; planned/active → cancelled.
-- Las transiciones las valida el servicio; la BD exige las fechas de cada estado.
create table public.workshops (
  id bigint generated always as identity primary key,
  evaluator_id bigint not null, -- administrativo.professionals.professional_id
  name text not null
    check (char_length(name) between 3 and 150 and name = btrim(name) and name !~ '\s{2,}'),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'planned'
    check (status in ('planned', 'active', 'finished', 'cancelled')),
  check (ends_at is null or starts_at is null or ends_at >= starts_at),
  -- active y finished exigen inicio; finished exige también fin.
  check (status not in ('active', 'finished') or starts_at is not null),
  check (status <> 'finished' or ends_at is not null)
);
select public.habilitar_auditoria('workshops', 'id');

-- Habilidades que se trabajan en un taller.
create table public.workshop_skills (
  id bigint generated always as identity primary key,
  workshop_id bigint not null references public.workshops (id) on delete restrict,
  skill_id bigint not null references public.skills (id) on delete restrict,
  unique (workshop_id, skill_id)
);
select public.habilitar_auditoria('workshop_skills', 'id');

-- Asistencia de estudiantes a talleres: permite ver quién asistió a un
-- taller y a qué talleres asistió un estudiante.
-- Se registra solo en talleres activos, sin fechas futuras y dentro de las
-- fechas del taller (lo valida el servicio).
create table public.workshop_attendances (
  id bigint generated always as identity primary key,
  student_id bigint not null, -- administrativo.children.child_id
  workshop_id bigint not null references public.workshops (id) on delete restrict,
  attended_at timestamptz not null default now(),
  observation text
    check (char_length(observation) between 1 and 1000)
);
select public.habilitar_auditoria('workshop_attendances', 'id');
-- Una asistencia vigente por estudiante, taller y día (día en hora de Bogotá).
create unique index workshop_attendances_daily_key on public.workshop_attendances
  (workshop_id, student_id, ((attended_at at time zone 'America/Bogota')::date))
  where eliminado_en is null;
create index on public.workshop_attendances (student_id);
create index on public.workshop_attendances (workshop_id);

-- Evaluación de una habilidad del taller para una asistencia concreta.
-- La habilidad debe pertenecer al taller de la asistencia (lo valida el servicio).
create table public.evaluation_skills (
  id bigint generated always as identity primary key,
  workshop_attendance_id bigint not null references public.workshop_attendances (id) on delete restrict,
  workshop_skill_id bigint not null references public.workshop_skills (id) on delete restrict,
  evaluation_scale_id bigint not null references public.evaluation_scales (id) on delete restrict,
  unique (workshop_attendance_id, workshop_skill_id)
);
select public.habilitar_auditoria('evaluation_skills', 'id');

-- =====================================================================
-- EVIDENCIAS
-- =====================================================================

-- Archivo (video, imagen, documento). Quién lo subió y cuándo quedan en
-- creado_por / creado_en (diagrama: upload_by / upload_at).
-- Debe relacionarse con 1 a 50 estudiantes activos (lo valida el servicio).
create table public.evidences (
  id bigint generated always as identity primary key,
  url text not null
    check (char_length(url) <= 2048 and url ~ '^https://\S+$'),
  title text not null
    check (char_length(title) between 2 and 150 and title = btrim(title) and title !~ '\s{2,}')
);
select public.habilitar_auditoria('evidences', 'id');

-- Estudiantes que aparecen o se relacionan con una evidencia.
create table public.student_evidences (
  id bigint generated always as identity primary key,
  student_id bigint not null, -- administrativo.children.child_id
  evidence_id bigint not null references public.evidences (id) on delete restrict,
  unique (student_id, evidence_id)
);
select public.habilitar_auditoria('student_evidences', 'id');
create index on public.student_evidences (evidence_id);

-- Certificado o credencial que obtiene un estudiante, opcionalmente
-- asociado a un taller.
-- Ciclo de vida: nace pending; pending → valid | revoked; valid → revoked.
-- Las transiciones y la regla del taller (finished y con asistencia del
-- estudiante) las valida el servicio.
create table public.credentials (
  id bigint generated always as identity primary key,
  student_id bigint not null, -- administrativo.children.child_id
  organization_name text not null
    check (char_length(organization_name) between 2 and 150
           and organization_name = btrim(organization_name) and organization_name !~ '\s{2,}'),
  workshop_id bigint references public.workshops (id) on delete restrict,
  url text not null
    check (char_length(url) <= 2048 and url ~ '^https://\S+$'),
  status text not null default 'pending'
    check (status in ('pending', 'valid', 'revoked'))
);
select public.habilitar_auditoria('credentials', 'id');
create index on public.credentials (student_id);

-- =====================================================================
-- SEGURIDAD POR FILAS (RLS)
-- El backend (Prisma) se conecta con un rol que no aplica RLS; estas
-- políticas protegen el acceso directo desde Supabase (PostgREST).
-- Los registros eliminados solo los ve la administración.
-- =====================================================================

alter table public.aplicaciones enable row level security;
alter table public.roles enable row level security;
alter table public.perfiles enable row level security;
alter table public.usuario_roles enable row level security;
alter table public.administrators enable row level security;
alter table public.skill_categories enable row level security;
alter table public.skills enable row level security;
alter table public.evaluation_scales enable row level security;
alter table public.student_skills enable row level security;
alter table public.workshops enable row level security;
alter table public.workshop_skills enable row level security;
alter table public.workshop_attendances enable row level security;
alter table public.evaluation_skills enable row level security;
alter table public.evidences enable row level security;
alter table public.student_evidences enable row level security;
alter table public.credentials enable row level security;

create policy "catalogo visible" on public.aplicaciones
  for select to authenticated using (eliminado_en is null);
create policy "roles visibles" on public.roles
  for select to authenticated using (eliminado_en is null);

-- Perfiles: cada quien ve el suyo; la administración ve todos.
create policy "ver perfil" on public.perfiles
  for select to authenticated
  using ((id = (select auth.uid()) and eliminado_en is null) or public.tiene_rol('administrador'));
create policy "editar mi perfil" on public.perfiles
  for update to authenticated
  using (id = (select auth.uid()) and eliminado_en is null) with check (id = (select auth.uid()));
create policy "admin edita perfiles" on public.perfiles
  for update to authenticated
  using (public.tiene_rol('administrador'));

-- El usuario solo puede cambiar estas columnas (no su estado ni su documento).
-- Las columnas de auditoría las escribe el trigger, no el usuario.
revoke update on public.perfiles from authenticated;
grant update (nombres, apellidos, celular, acepto_tratamiento_datos_en)
  on public.perfiles to authenticated;

-- Roles: cada quien ve los suyos; solo la administración asigna o quita.
create policy "ver mis roles" on public.usuario_roles
  for select to authenticated
  using ((usuario_id = (select auth.uid()) and eliminado_en is null) or public.tiene_rol('administrador'));
create policy "admin asigna roles" on public.usuario_roles
  for all to authenticated
  using (public.tiene_rol('administrador'))
  with check (public.tiene_rol('administrador'));

-- Catálogos del módulo: lectura para cualquier usuario autenticado.
create policy "ver categorias" on public.skill_categories
  for select to authenticated using (eliminado_en is null);
create policy "ver habilidades" on public.skills
  for select to authenticated using (eliminado_en is null);
create policy "ver escalas" on public.evaluation_scales
  for select to authenticated using (eliminado_en is null);

-- Todas las tablas del módulo: la administración gestiona todo.
do $$
declare
  t text;
begin
  foreach t in array array[
    'administrators', 'skill_categories', 'skills', 'evaluation_scales', 'student_skills',
    'workshops', 'workshop_skills', 'workshop_attendances', 'evaluation_skills',
    'evidences', 'student_evidences', 'credentials'
  ] loop
    execute format(
      'create policy "admin gestiona" on public.%I for all to authenticated
         using (public.tiene_rol(''administrador'')) with check (public.tiene_rol(''administrador''))',
      t
    );
  end loop;
end;
$$;
