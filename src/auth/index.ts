// API pública de la feature: dominio + aplicación. La infraestructura solo
// la importa la raíz de composición (src/container.ts).
export type * from "./domain/auth.entity.js";
export type * from "./domain/auth.gateway.js";
export * from "./application/auth.service.js";
