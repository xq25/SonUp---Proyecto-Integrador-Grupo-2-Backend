import swaggerJSDoc from "swagger-jsdoc";
import { API_DOC_FILES, API_PREFIX } from "./api.routes.js";

/**
 * Especificación OpenAPI que muestra Swagger UI en `/api-docs` (ADR-005).
 * Las rutas salen de `src/docs/api-routes.yaml`, que genera `npm run docs:requests`.
 * Se documentan como en el código (`/workshops`): el prefijo va en la URL de cada servidor.
 */
export function createSwaggerSpec(): object {
  const servers = [
    {
      url: `http://localhost:${process.env["PORT"] ?? 3000}${API_PREFIX}`,
      description: "Local (la API corriendo en este equipo)",
    },
  ];
  // PUBLIC_URL (opcional): URL pública del despliegue, sin el prefijo. Va primero
  // para que Swagger la use por defecto: en el despliegue, "localhost" apunta al
  // equipo de quien abre Swagger, no al servidor.
  const publicUrl = process.env["PUBLIC_URL"]?.trim().replace(/\/+$/, "");
  if (publicUrl) servers.unshift({ url: `${publicUrl}${API_PREFIX}`, description: "Despliegue" });

  return swaggerJSDoc({
    definition: {
      openapi: "3.0.0",
      info: {
        title: "API SonUp · Seguimiento y desarrollo de estudiantes",
        version: "1.0.0",
        description: "API REST del módulo de seguimiento y desarrollo de estudiantes",
      },
      servers,
    },
    apis: API_DOC_FILES,
  });
}
