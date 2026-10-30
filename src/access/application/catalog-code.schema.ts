import { z } from "zod";

// Tablas heredadas del script de login: reglas según la PROPUESTA de
// docs/VALIDACIONES.md §4 (pendiente de revisión tabla por tabla).

/** Código de rol o aplicación: 2–30 letras, números o `_` (p. ej. "aula_up", "asisConnection"). */
export const catalogCodeSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_]{2,30}$/, "El código solo admite letras, números y _, de 2 a 30 caracteres");
