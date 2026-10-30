import type { FieldIssue } from "../../shared/domain/errors.js";
import type { AuthSession, LoginInput } from "../domain/auth-session.entity.js";
import type { AuthUser } from "../domain/auth-user.entity.js";
import type { RegisterUserInput, RegistrationResult } from "../domain/registration.entity.js";

// Traducción entre el formato del servicio de autenticación del módulo
// administrativo y los DTOs de este módulo (ADR-003).
// - Salida: nuestros nombres en inglés → los suyos (`password` → `clave`).
// - Entrada: su respuesta puede variar, así que se lee de forma tolerante
//   (varios nombres posibles por dato) y se conserva SOLO lo que usamos.
// Si su contrato cambia, este es el único archivo que se ajusta.

// ── Hacia el servicio administrativo ──

export interface AdministrativeRegisterRequest {
  username: string;
  email: string;
  clave: string;
  rol: string;
}

export interface AdministrativeLoginRequest {
  email: string;
  clave: string;
}

export const toRegisterRequest = (input: RegisterUserInput): AdministrativeRegisterRequest => ({
  username: input.username,
  email: input.email,
  clave: input.password,
  rol: input.role,
});

export const toLoginRequest = (input: LoginInput): AdministrativeLoginRequest => ({
  email: input.email,
  clave: input.password,
});

// ── Desde el servicio administrativo ──

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);

/** Primer valor presente entre varios nombres posibles. */
const pick = (source: Json, keys: readonly string[]): unknown => {
  for (const key of keys) if (source[key] !== undefined && source[key] !== null) return source[key];
  return undefined;
};

const text = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return null;
};

/** Objeto anidado en alguno de esos nombres (p. ej. `data`, `usuario`). */
const nested = (source: Json, keys: readonly string[]): Json | undefined => {
  const value = pick(source, keys);
  return isObject(value) ? value : undefined;
};

/** Muchas APIs envuelven la respuesta en `data`/`datos`/`resultado`. */
const unwrap = (raw: unknown): Json => {
  if (!isObject(raw)) return {};
  return nested(raw, ["data", "datos", "resultado", "result"]) ?? raw;
};

const USER_KEYS = ["usuario", "user", "perfil", "profile"] as const;
const TOKEN_KEYS = ["token", "accessToken", "access_token", "tokenAcceso", "jwt"] as const;

/** Un rol puede llegar como texto (`"ESTUDIANTE"`) o como objeto (`{ codigo, nombre }`). */
const roleCode = (role: unknown): string | null => {
  const value = isObject(role) ? pick(role, ["codigo", "code", "rol", "nombre", "name"]) : role;
  return text(value)?.toUpperCase() ?? null;
};

const rolesOf = (source: Json): string[] => {
  const value = pick(source, ["roles", "rol", "role"]);
  const list = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return [...new Set(list.map(roleCode).filter((code): code is string => code !== null))];
};

/** Usuario a partir de un objeto que lo describe. `null` si no trae ningún dato reconocible. */
const userFrom = (source: Json | undefined): AuthUser | null => {
  if (!source) return null;
  const user: AuthUser = {
    id: text(pick(source, ["id", "id_usuario", "usuario_id", "userId", "uuid"])),
    username: text(pick(source, ["username", "nombre_usuario", "nombreUsuario", "usuario"])),
    email: text(pick(source, ["email", "correo"])),
    roles: rolesOf(source),
  };
  return user.id === null && user.username === null && user.email === null && user.roles.length === 0 ? null : user;
};

const sessionFrom = (body: Json): AuthSession | null => {
  const tokenHolder = nested(body, ["sesion", "session", "tokens"]) ?? body;
  const token = text(pick(tokenHolder, TOKEN_KEYS));
  if (token === null) return null;
  const expiresIn = Number(pick(tokenHolder, ["expiresIn", "expires_in", "expiraEn", "expira_en"]));
  return {
    token,
    tokenType: "Bearer",
    expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : null,
    // El usuario puede venir anidado o al mismo nivel que el token.
    user: userFrom(nested(body, USER_KEYS)) ?? userFrom(body),
  };
};

/** Respuesta de inicio de sesión. `null` si no trae token (respuesta inesperada). */
export const toAuthSession = (raw: unknown): AuthSession | null => sessionFrom(unwrap(raw));

/** Respuesta del perfil: el usuario puede venir anidado o ser la respuesta misma. */
export const toAuthUser = (raw: unknown): AuthUser | null => {
  const body = unwrap(raw);
  return userFrom(nested(body, USER_KEYS)) ?? userFrom(body);
};

/** Respuesta del registro: mensaje, usuario creado y sesión si ya la abre. */
export const toRegistrationResult = (raw: unknown): RegistrationResult => {
  const body = unwrap(raw);
  const session = sessionFrom(body);
  return {
    message: text(isObject(raw) ? pick(raw, ["mensaje", "message"]) : undefined),
    user: session?.user ?? userFrom(nested(body, USER_KEYS)) ?? userFrom(body),
    session,
  };
};

// ── Errores del servicio administrativo ──
// Formato observado: { "error": "…", "detalles": [{ "campo": "clave", "mensaje": "…" }] }

/** Sus nombres de campo → los nuestros, para que el front vea los campos que envió. */
const FIELD_NAMES: Record<string, string> = { clave: "password", rol: "role", correo: "email", usuario: "username" };

export const toErrorMessage = (raw: unknown): string | null =>
  isObject(raw) ? text(pick(raw, ["error", "mensaje", "message"])) : null;

export const toFieldIssues = (raw: unknown): FieldIssue[] => {
  const list = isObject(raw) ? pick(raw, ["detalles", "details", "errores", "errors"]) : undefined;
  if (!Array.isArray(list)) return [];
  return list.filter(isObject).map((issue) => {
    const field = text(pick(issue, ["campo", "field", "path"])) ?? "(entrada)";
    return {
      path: FIELD_NAMES[field] ?? field,
      message: text(pick(issue, ["mensaje", "message"])) ?? "Valor inválido",
    };
  });
};
