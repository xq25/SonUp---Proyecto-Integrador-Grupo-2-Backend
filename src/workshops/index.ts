// API pública de la feature: dominio + aplicación. La infraestructura solo
// la importa la raíz de composición (src/container.ts).
export * from "./domain/workshop.entity.js";
export type * from "./domain/workshop-skill.entity.js";
export type * from "./domain/workshop-attendance.entity.js";
export type * from "./domain/workshop.repository.js";
export type * from "./domain/workshop-skill.repository.js";
export type * from "./domain/workshop-attendance.repository.js";
export * from "./application/workshops.service.js";
export * from "./application/workshop-skills.service.js";
export * from "./application/attendance.service.js";
