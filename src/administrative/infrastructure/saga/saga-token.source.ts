import { UnauthorizedError } from "../../../shared/domain/errors.js";
import { currentRequestToken } from "../../../shared/infrastructure/request-context.js";
import type { SagaToken, SagaTokenSource } from "./saga-http.client.js";

/** Lo mínimo que se necesita de la sesión de servicio (ServiceSession, en auth). */
interface ServiceTokens {
  getToken(forceRefresh?: boolean): Promise<string>;
}

/**
 * Token para Saga (ADR-008): el del usuario de la petición en curso, para que
 * Saga aplique sus propios permisos; fuera de una petición (scripts, jobs) o
 * en desarrollo con `X-Actor-Id`, el del usuario de servicio.
 */
export class RequestSagaTokenSource implements SagaTokenSource {
  constructor(private readonly service: ServiceTokens) {}

  async getToken(forceRefresh = false): Promise<SagaToken> {
    const userToken = currentRequestToken();
    if (userToken !== undefined) {
      // El token del usuario no se puede renovar desde aquí: debe iniciar sesión de nuevo.
      if (forceRefresh) throw new UnauthorizedError("El módulo administrativo rechazó tu sesión: inicia sesión de nuevo");
      return { value: userToken, fromUser: true };
    }
    return { value: await this.service.getToken(forceRefresh), fromUser: false };
  }
}
