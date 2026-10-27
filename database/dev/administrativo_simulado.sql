-- =====================================================================
-- SOLO PARA LA BD DE PRUEBAS DEL MÓDULO. NUNCA EJECUTAR EN LA BD GENERAL.
--
-- Simula las tablas del módulo administrativo que este módulo consume en
-- solo lectura (docs/CONTEXTO_Y_ARQUITECTURA.md §3.3). En la BD general esas
-- tablas son del equipo administrativo: ejecutar este script allí podría
-- chocar con ellas o mezclar datos falsos con datos reales.
--
-- Orden en la BD de pruebas:
--   1. database/asisco_login_supabase.sql   (nuestras tablas)
--   2. este archivo                         (tablas simuladas + datos de ejemplo)
-- Se puede ejecutar varias veces: no duplica tablas ni datos.
--
-- Columnas y tipos según el diagrama del módulo administrativo. La
-- nulabilidad no aparece en su diagrama: salvo llaves, todo es opcional
-- (igual que en prisma/schema.prisma).
-- =====================================================================

create schema if not exists administrativo;

create table if not exists administrativo.children (
  child_id        bigint primary key,
  first_name      text,
  last_name       text,
  birth_date      date,
  sex             smallint,
  document_type   smallint,
  document_number text,
  admission_date  date,
  exit_date       date,       -- con fecha pasada = el joven ya salió de la fundación
  status_id       smallint,
  notes           text
);

create table if not exists administrativo.guardians (
  guardian_id     bigint primary key,
  full_name       text,
  document_type   text,
  document_number text,
  phone           text,
  address         text,
  legal_status_id text
);

create table if not exists administrativo.children_guardians (
  child_guardian_id bigint primary key,
  child_id          bigint not null references administrativo.children (child_id),
  guardian_id       bigint not null references administrativo.guardians (guardian_id),
  guardianship_type text,
  start_date        date,
  end_date          date      -- null = vínculo vigente
);

create table if not exists administrativo.professionals (
  professional_id bigint primary key,
  staff_id        bigint not null, -- staff no se integra en este módulo
  titles          text,
  institutions    text,
  observations    text,
  time_donor      boolean
);

-- Datos de ejemplo -----------------------------------------------------
-- Los códigos de sex, document_type y status_id son inventados: el catálogo
-- real lo define el módulo administrativo.

insert into administrativo.children
  (child_id, first_name, last_name, birth_date, sex, document_type, document_number, admission_date, exit_date, status_id, notes)
values
  (1, 'Leo',    'Paz',   '2015-03-02', 1, 1, 'TI-1001', '2024-02-01', null,         1, null),
  (2, 'Ana',    'Gil',   '2014-07-09', 2, 1, 'TI-1002', '2023-01-15', null,         1, null),
  (3, 'Sara',   'Ríos',  '2012-11-20', 2, 1, 'TI-1003', '2021-03-01', '2025-12-15', 2, 'Salió de la fundación'),
  (4, 'Tomás',  'Vega',  '2016-05-30', 1, 2, 'RC-1004', '2025-02-10', null,         1, null),
  (5, 'Valeria','Mora',  '2013-09-14', 2, 1, 'TI-1005', '2022-08-22', null,         1, null)
on conflict (child_id) do nothing;

insert into administrativo.guardians
  (guardian_id, full_name, document_type, document_number, phone, address, legal_status_id)
values
  (10, 'María Paz',  'CC', 'CC-2001', '3001112233', 'Calle 1 # 2-3', 'ok'),
  (11, 'Luis Paz',   'CC', 'CC-2002', '3002223344', 'Calle 1 # 2-3', 'ok'),
  (12, 'Rosa Gil',   'CC', 'CC-2003', '3003334455', 'Carrera 5 # 6-7', 'ok'),
  (13, 'Jorge Mora', 'CE', 'CE-2004', '3004445566', 'Avenida 8 # 9-10', 'ok')
on conflict (guardian_id) do nothing;

insert into administrativo.children_guardians
  (child_guardian_id, child_id, guardian_id, guardianship_type, start_date, end_date)
values
  (100, 1, 10, 'madre',  '2024-02-01', null),
  (101, 1, 11, 'padre',  '2024-02-01', '2025-01-01'),  -- vínculo ya terminado
  (102, 2, 12, 'abuela', '2023-01-15', null),
  (103, 5, 13, 'padre',  '2022-08-22', null)
on conflict (child_guardian_id) do nothing;

insert into administrativo.professionals
  (professional_id, staff_id, titles, institutions, observations, time_donor)
values
  (500, 77, 'Licenciatura en Música', 'Universidad de Antioquia', null, true),
  (501, 78, 'Psicología',             'Universidad Nacional',     'Talleres socioemocionales', false),
  (502, 79, 'Artes Plásticas',        'Universidad de Caldas',    null, true)
on conflict (professional_id) do nothing;
