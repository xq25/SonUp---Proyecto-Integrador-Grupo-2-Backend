-- =====================================================================
-- Migración 2026-11-09 · Retirar public.administrators
--
-- Desde ADR-006 los administrativos se leen de `staff` de Saga, en solo
-- lectura: la tabla propia quedó sin uso (no está en el script principal,
-- ni en Prisma, ni en el código). Solo existe en bases creadas antes de ese
-- cambio (p. ej. la BD de pruebas del módulo).
--
-- Antes de ejecutarla, respaldar sus filas si se quieren conservar:
--   select * from public.administrators;
--
-- Nada depende de ella (sin FKs, vistas ni funciones que la usen). Sus
-- triggers de auditoría y su política RLS se eliminan con la tabla.
-- Se puede ejecutar más de una vez.
-- =====================================================================

drop table if exists public.administrators;
