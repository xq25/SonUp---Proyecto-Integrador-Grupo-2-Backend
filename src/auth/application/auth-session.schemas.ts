import { z } from "zod";
import type { LoginInput } from "../domain/auth-session.entity.js";
import { authEmailSchema, passwordSchema } from "./auth-input.schemas.js";

// Esquema de inicio de sesión (nivel 1, ADR-001). Las credenciales las valida el módulo administrativo.

export const loginSchema = z.strictObject({
  email: authEmailSchema,
  password: passwordSchema,
}) satisfies z.ZodType<LoginInput>;
