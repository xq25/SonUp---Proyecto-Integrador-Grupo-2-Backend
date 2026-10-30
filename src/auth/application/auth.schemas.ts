import { z } from "zod";
import type { LoginInput, RegisterUserInput } from "../domain/auth.entity.js";

// Esquemas de entrada de autenticación (nivel 1, ADR-001).
// Solo la forma: las reglas de usuario, clave y roles son del módulo
// administrativo, que las valida y cuyos errores se remiten tal cual (ADR-003).

/** Email sin espacios. No se pasa a minúsculas: se envía como lo escribió el usuario. */
const emailSchema = z.string().trim().pipe(z.email("Email inválido").max(254, "Debe tener como máximo 254 caracteres"));

/** La clave nunca se recorta ni se transforma. */
const passwordSchema = z
  .string()
  .min(1, "La clave es obligatoria")
  .max(128, "Debe tener como máximo 128 caracteres");

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
}) satisfies z.ZodType<LoginInput>;

export const registerUserSchema = z.strictObject({
  username: z
    .string()
    .trim()
    .min(1, "El usuario es obligatorio")
    .max(100, "Debe tener como máximo 100 caracteres")
    .regex(/^\S+$/, "No puede tener espacios"),
  email: emailSchema,
  password: passwordSchema,
  // Código del catálogo de roles del módulo administrativo (hoy el registro público admite ACUDIENTE y DONANTE).
  role: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z_]{2,30}$/, "Debe ser un código de rol (letras y _), p. ej. ACUDIENTE"),
}) satisfies z.ZodType<RegisterUserInput>;
