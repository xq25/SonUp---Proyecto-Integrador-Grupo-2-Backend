# ADR-005 · Swagger UI generado desde el catálogo de rutas

| | |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | 2026-10-30 |
| **Decidió** | Equipo del módulo |
| **Dependencias** | `swagger-jsdoc@6.3`, `swagger-ui-express@5.0` (ejecución); `@types/swagger-jsdoc@6.0`, `@types/swagger-ui-express@4.1` (desarrollo) |
| **Relacionado** | [ADR-002](ADR-002-capa-http-express.md) · [ADR-004](ADR-004-un-archivo-por-entidad.md) · `scripts/request-catalog.ts` |

## 1. Contexto

- El equipo necesita ver y probar todas las rutas de la API en un solo lugar.
- Anotar a mano las rutas con `@openapi` duplicaría `scripts/request-catalog.ts`, que ya describe cada ruta y cada cuerpo, y se validan contra Express y Zod.

## 2. Decisión

- **Swagger UI en `/api-docs`:** pública y fuera de `/api`, montada en `src/shared/http/app.ts`.
- **Rutas generadas:** `npm run docs:requests` escribe `src/docs/api-routes.yaml` desde el catálogo. No se edita a mano.
  - La forma de los cuerpos sale de los esquemas Zod (`z.toJSONSchema`).
  - Las reglas y los ejemplos salen del catálogo.
- **Carga:** `src/shared/http/swagger.ts` usa `swagger-jsdoc` con `API_DOC_FILES` (`src/shared/http/api.routes.ts`).
- **Directorio general:** cada módulo tiene su catálogo (`<feature>/http/<feature>.catalog.ts`) y `api.routes.ts` los reúne.
- **Anotaciones opcionales:** `API_DOC_FILES` también lee `@openapi` en los `.routes.ts` y `.catalog.ts`, y otros YAML de `src/docs/`, por si una ruta necesita más detalle.

## 3. Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Anotar a mano las 84 rutas | Duplica el catálogo y se desactualiza sin que nada lo detecte |
| Solo la colección de Postman | Hay que importarla; no da una vista navegable desde el navegador |

## 4. Consecuencias

- **Al cambiar una ruta o un esquema:** actualizar el catálogo y ejecutar `npm run docs:requests`, como ya se hacía. Swagger queda al día con eso.
- **Las respuestas exitosas no tienen esquema:** el catálogo solo describe entradas. Se documentan el código y la descripción, y los errores con `ApiError`.
- **`/api-docs` también queda público en producción.** Debe revisarse con el equipo de seguridad antes de desplegar.
- **Cuatro dependencias nuevas**, sin cambios en la lógica de los servicios.
