import { z } from "zod";

// Piezas comunes de los esquemas de autenticación (nivel 1, ADR-001).
// Solo la forma: las reglas de usuario, clave y roles son del módulo
// administrativo, que las valida y cuyos errores se remiten tal cual (ADR-003).

/** Email sin espacios. No se pasa a minúsculas: se envía como lo escribió el usuario. */
export const authEmailSchema = z
  .string()
  .trim()
  .pipe(z.email("Email inválido").max(254, "Debe tener como máximo 254 caracteres"));

/** La clave nunca se recorta ni se transforma. */
export const passwordSchema = z
  .string()
  .min(1, "La clave es obligatoria")
  .max(128, "Debe tener como máximo 128 caracteres");
