import type { RequestHandler } from "express";
import { ForbiddenError } from "../domain/errors.js";

// Autorización por rol (ADR-008): compara los roles del usuario (los deja
// `authenticate` en `res.locals`) con la matriz ruta → roles. Va después de
// `authenticate` y antes de los routers.

interface CompiledRoute {
  method: string;
  route: string;
  pattern: RegExp;
  /** Segmentos fijos: ante dos coincidencias gana la más específica (`/scales/classify` sobre `/scales/:id`). */
  literals: number;
  roles: readonly string[];
}

const compile = (permissions: Readonly<Record<string, readonly string[]>>): CompiledRoute[] =>
  Object.entries(permissions).map(([key, roles]) => {
    const [method, route] = key.split(" ") as [string, string];
    const segments = route.split("/").filter(Boolean);
    const regex = segments.map((s) => (s.startsWith(":") ? "[^/]+" : s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("/");
    return {
      method,
      route,
      pattern: new RegExp(`^/${regex}/?$`),
      literals: segments.filter((s) => !s.startsWith(":")).length,
      roles,
    };
  });

/** La ruta de la matriz que corresponde a la petición, o `undefined` si no está (la atiende el 404). */
function findRoute(routes: readonly CompiledRoute[], method: string, path: string): CompiledRoute | undefined {
  let best: CompiledRoute | undefined;
  for (const route of routes) {
    if (route.method !== method || !route.pattern.test(path)) continue;
    if (!best || route.literals > best.literals) best = route;
  }
  return best;
}

export function authorize(permissions: Readonly<Record<string, readonly string[]>>): RequestHandler {
  const routes = compile(permissions);
  return (req, res, next) => {
    const route = findRoute(routes, req.method, req.path);
    // Ruta inexistente: sigue hasta el 404. (`docs:requests` exige que toda ruta registrada esté en la matriz.)
    if (!route) return next();
    const roles = (res.locals["roles"] as string[] | undefined) ?? [];
    if (!roles.some((role) => route.roles.includes(role))) {
      const yours = roles.length > 0 ? roles.join(", ") : "ninguno";
      throw new ForbiddenError(
        `Tu rol (${yours}) no tiene permiso para ${req.method} ${route.route}. Roles permitidos: ${route.roles.join(", ")}`,
      );
    }
    next();
  };
}
