import { z } from "zod";
import { DOCUMENT_TYPES } from "../domain/document-types.js";

// Esquemas reutilizables del nivel 1 (ADR-001). Implementan las reglas
// generales de docs/VALIDACIONES.md §2. Cada feature los combina en sus
// propios esquemas de entrada (`<feature>/application/<entity>.schemas.ts`).

/** Nombres y títulos: sin espacios al inicio/fin y sin espacios dobles. */
const normalizeName = (value: string): string => value.trim().replace(/\s+/g, " ");

/** Emails: sin espacios y en minúsculas (unicidad sin distinguir mayúsculas). */
const normalizeEmail = (value: string): string => value.trim().toLowerCase();

/** Longitud máxima de una URL (también es un check en la BD). */
export const MAX_URL_LENGTH = 2048;

/** Id (`bigint` > 0). Acepta `bigint`, número o texto ("12"), como llegará desde HTTP. */
export const idSchema = z.coerce.bigint({ error: "Debe ser un id numérico" }).positive("Debe ser un id positivo");

/** Nombres y títulos: sin espacios sobrantes (inicio/fin y dobles) y con longitud acotada. */
export const nameSchema = (min: number, max: number) =>
  z
    .string()
    .transform(normalizeName)
    .pipe(
      z
        .string()
        .min(min, `Debe tener al menos ${min} caracteres`)
        .max(max, `Debe tener como máximo ${max} caracteres`),
    );

/** Texto largo opcional: sin espacios al inicio/fin; vacío → `null`. */
export const optionalTextSchema = (max: number) =>
  z
    .string()
    .nullable()
    .transform((value) => (value === null || value.trim() === "" ? null : value.trim()))
    .pipe(z.string().max(max, `Debe tener como máximo ${max} caracteres`).nullable());

/** Email en minúsculas, máx. 254. */
export const emailSchema = z.string().transform(normalizeEmail).pipe(z.email("Email inválido").max(254));

/** Enlace `https`, sin espacios, máx. 2048 (la BD lo refuerza con un check). */
export const httpsUrlSchema = z
  .string()
  .trim()
  .max(MAX_URL_LENGTH, `Debe tener como máximo ${MAX_URL_LENGTH} caracteres`)
  .regex(/^\S+$/, "No puede tener espacios")
  .pipe(z.url({ protocol: /^https$/, error: "Debe ser una URL https válida" }));

/** Fecha y hora. Acepta `Date` o texto ISO 8601 (p. ej. "2026-03-10T15:00:00Z"). */
export const dateTimeSchema = z.coerce.date({ error: "Debe ser una fecha válida (ISO 8601)" });

/** Nombre de persona: como `nameSchema`, pero solo letras (con tildes), espacios, `'` y `-`. */
export const personNameSchema = (min: number, max: number) =>
  nameSchema(min, max).pipe(z.string().regex(/^[\p{L}\s'-]+$/u, "Solo admite letras, espacios, ' y -"));

/** Teléfono E.164: solo dígitos, `+` opcional al inicio, de 7 a 15 dígitos. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?\d{7,15}$/, "Debe tener de 7 a 15 dígitos, con + opcional al inicio");

/** Número de documento: letras, números y guion, de 3 a 20 caracteres, sin espacios. */
export const documentNumberSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9-]{3,20}$/, "Debe tener de 3 a 20 letras, números o guiones, sin espacios");

/**
 * UUID (p. ej. id de perfil = auth.users.id). Se valida solo el formato
 * hexadecimal 8-4-4-4-12, igual que el tipo `uuid` de Postgres (z.uuid() exigiría
 * además versión y variante RFC y rechazaría ids que la BD sí acepta).
 */
export const uuidSchema = z.guid("Debe ser un UUID válido");

/** Tipo de documento del catálogo general. */
export const documentTypeSchema = z.enum(DOCUMENT_TYPES, { error: `Debe ser uno de: ${DOCUMENT_TYPES.join(", ")}` });
