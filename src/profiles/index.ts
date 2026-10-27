// API pública de la feature: dominio + aplicación. La infraestructura solo
// la importa la raíz de composición (src/container.ts).
export * from "./domain/profile.entity.js";
export type * from "./domain/profile.repository.js";
export * from "./application/profiles.service.js";
