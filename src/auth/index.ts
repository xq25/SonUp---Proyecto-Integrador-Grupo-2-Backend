// API pública de la feature: dominio + aplicación. La infraestructura solo
// la importa la raíz de composición (src/container.ts).
export type * from "./domain/auth-user.entity.js";
export type * from "./domain/auth-session.entity.js";
export type * from "./domain/registration.entity.js";
export type * from "./domain/auth.gateway.js";
export * from "./application/auth.service.js";
export type * from "./domain/principal.entity.js";
export type * from "./domain/token-verifier.js";
export * from "./domain/roles.js";
export * from "./domain/actor-links.js";
export * from "./application/access-policy.js";
