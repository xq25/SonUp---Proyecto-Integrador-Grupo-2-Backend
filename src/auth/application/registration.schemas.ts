import { z } from "zod";
import type { RegisterUserInput } from "../domain/registration.entity.js";
import { authEmailSchema, passwordSchema } from "./auth-input.schemas.js";

// Esquema de registro (nivel 1, ADR-001). Las reglas de la cuenta las valida el módulo administrativo.

export const registerUserSchema = z.strictObject({
  username: z
    .string()
    .trim()
    .min(1, "El usuario es obligatorio")
    .max(100, "Debe tener como máximo 100 caracteres")
    .regex(/^\S+$/, "No puede tener espacios"),
  email: authEmailSchema,
  password: passwordSchema,
  // Código del catálogo de roles del módulo administrativo (hoy el registro público admite ACUDIENTE y DONANTE).
  role: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z_]{2,30}$/, "Debe ser un código de rol (letras y _), p. ej. ACUDIENTE"),
}) satisfies z.ZodType<RegisterUserInput>;
