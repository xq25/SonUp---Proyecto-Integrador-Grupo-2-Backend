// API pública de la feature: dominio + aplicación. La infraestructura solo
// la importa la raíz de composición (src/container.ts).
export * from "./domain/evidence.entity.js";
export type * from "./domain/student-evidence.entity.js";
export * from "./domain/credential.entity.js";
export type * from "./domain/evidence.repository.js";
export type * from "./domain/student-evidence.repository.js";
export type * from "./domain/credential.repository.js";
export * from "./application/evidences.service.js";
export * from "./application/student-evidences.service.js";
export * from "./application/credentials.service.js";
