// API pública de la feature: dominio + aplicación. La infraestructura solo
// la importa la raíz de composición (src/container.ts).
export type * from "./domain/app.entity.js";
export type * from "./domain/role.entity.js";
export type * from "./domain/user-role.entity.js";
export type * from "./domain/app.repository.js";
export type * from "./domain/role.repository.js";
export type * from "./domain/user-role.repository.js";
export * from "./application/apps.service.js";
export * from "./application/roles.service.js";
export * from "./application/user-roles.service.js";
