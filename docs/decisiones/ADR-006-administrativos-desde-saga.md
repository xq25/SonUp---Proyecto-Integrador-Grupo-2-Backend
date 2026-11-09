# ADR-006 · Los administrativos se leen de `staff` del módulo administrativo (Saga)

| | |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | 2026-11-06 |
| **Decidió** | Equipo del módulo |
| **Dependencias** | Ninguna |
| **Relacionado** | `docs/CONTEXTO_Y_ARQUITECTURA.md` §3.3 · [ADR-004](ADR-004-un-archivo-por-entidad.md) · [VALIDACIONES.md §3.1](../VALIDACIONES.md) |

## 1. Contexto

- Los administrativos tenían una tabla **provisional** propia, `public.administrators`, con CRUD completo: crear, actualizar, eliminar y restaurar.
- Su información es del **módulo administrativo (Saga)**, en su tabla `staff`. Allí está todo el personal de la fundación: administrativos y talleristas (`professionals.staff_id`).
- Como con `children`, `guardians` y `professionals`, este módulo solo debe **consumirla**: no puede crear, modificar ni eliminar personal.

## 2. Decisión

- **Se retira la tabla provisional `administrators`:**
  - sale de `database/asisco_login_supabase.sql` y de `prisma/schema.prisma`;
  - se elimina la feature `src/administrators/`;
  - se quitan sus 6 rutas: `GET/POST /administrators`, `GET/PATCH/DELETE /administrators/:id` y `POST /administrators/:id/restore`.
- **Se lee `administrativo.staff` en solo lectura**, dentro de `src/administrative/`:
  - entidad `Staff`;
  - puerto `StaffReader`;
  - `PrismaStaffReader`;
  - `StaffService` (`get`, `list`);
  - clave del contenedor `staff`.
- **Rutas:** `GET /staff` (filtros `role`, `status`, `search`) y `GET /staff/:id`. No hay rutas de escritura.
- **Se exponen solo los datos que usa el módulo:** nombre, documento, `role`, fechas de ingreso y salida, `status`, teléfono y email.
  - Los datos laborales (`contract_type`, `hours_worked`, `hours_payed`) se mapean en Prisma, pero no se leen.
  - No hay filtro fijo por rol porque los valores de `role` y `status` los define Saga.

## 3. Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Mantener `administrators` con solo lectura | Dos fuentes de verdad para la misma persona; la tabla quedaría desactualizada frente a Saga |
| Mantener las rutas `/administrators` leyendo `staff` | `staff` incluye talleristas y no se conoce el valor de `role` de un administrativo: el nombre sería engañoso |

## 4. Consecuencias

- **Cambio incompatible para el front:** `/administrators` deja de existir; se usa `GET /staff` (por ejemplo, `?role=…` cuando Saga confirme sus valores).
- **BD de pruebas:**
  - `database/dev/administrativo_simulado.sql` simula `staff`: talleristas 77–79 y administrativos 80–81, con valores de `role` y `status` inventados.
  - El seed ya no crea administrativos.
  - La tabla `public.administrators` de la BD de pruebas quedó sin uso. Se retiró el 2026-11-09 con `database/migraciones/2026-11-09-retirar-administrators.sql`.
- **Pendiente con Saga:**
  - los valores de `role` y `status`;
  - la nulabilidad de las columnas;
  - el permiso de lectura sobre `staff`.
