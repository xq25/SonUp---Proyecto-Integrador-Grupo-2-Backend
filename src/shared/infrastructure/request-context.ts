import { AsyncLocalStorage } from "node:async_hooks";

// Contexto de la petición en curso (ADR-008): guarda el token del usuario para
// reenviarlo a otros módulos (p. ej. Saga) sin pasarlo por los servicios, que
// no saben de HTTP. Fuera de una petición (scripts, jobs) no hay contexto.

interface RequestContext {
  /** Token del servicio de seguridad con que llegó la petición. */
  token: string | undefined;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Ejecuta `fn` (y todo lo que dispare, aunque sea asíncrono) dentro del contexto. */
export const runWithRequestContext = <T>(context: RequestContext, fn: () => T): T => storage.run(context, fn);

/** Token del usuario de la petición en curso, si llegó con uno. */
export const currentRequestToken = (): string | undefined => storage.getStore()?.token;
