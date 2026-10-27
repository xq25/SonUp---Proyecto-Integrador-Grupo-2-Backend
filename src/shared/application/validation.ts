import { z } from "zod";
import { type FieldIssue, ValidationError } from "../domain/errors.js";

// Mensajes de Zod en español (los mensajes propios de cada esquema se escriben en español).
z.config(z.locales.es());

/**
 * Valida y normaliza una entrada con su esquema (nivel 1, ADR-001).
 * Si falla, lanza un ValidationError con el detalle de todos los campos
 * inválidos: el resto del código solo conoce errores de dominio.
 */
export function parseInput<S extends z.ZodType>(schema: S, data: unknown, entity: string): z.output<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const details: FieldIssue[] = result.error.issues.flatMap((issue): FieldIssue[] => {
    const base = issue.path.map(String);
    // Campos desconocidos (objetos estrictos): un detalle por campo, con su nombre.
    if (issue.code === "unrecognized_keys") {
      return issue.keys.map((key) => ({ path: [...base, key].join("."), message: "Campo no permitido" }));
    }
    return [{ path: base.join(".") || "(entrada)", message: issue.message }];
  });
  const summary = details.map((d) => `${d.path}: ${d.message}`).join("; ");
  throw new ValidationError(`${entity}: datos de entrada inválidos (${summary})`, details);
}
