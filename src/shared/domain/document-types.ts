// Catálogo de tipos de documento (Colombia). Regla general de validación:
// ver docs/VALIDACIONES.md §2. Las tablas que lo usan lo refuerzan con un check.
export const DOCUMENT_TYPES = ["CC", "TI", "CE", "PA", "RC", "PPT", "NIT"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
