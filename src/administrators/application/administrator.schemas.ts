import { z } from "zod";
import {
  documentNumberSchema,
  documentTypeSchema,
  emailSchema,
  nameSchema,
  personNameSchema,
  phoneSchema,
} from "../../shared/application/schemas.js";
import {
  ADMINISTRATOR_STATUSES,
  type CreateAdministratorInput,
  type UpdateAdministratorInput,
} from "../domain/administrator.entity.js";

// Esquemas de entrada de administrativos (nivel 1, ADR-001; docs/VALIDACIONES.md §3.1).
// La unicidad de documento y email (nivel 2) sigue en el servicio.

const fields = {
  fullName: personNameSchema(3, 150),
  documentType: documentTypeSchema,
  documentNumber: documentNumberSchema,
  email: emailSchema,
  phone: phoneSchema.nullable(),
  position: nameSchema(2, 100),
  status: z.enum(ADMINISTRATOR_STATUSES, { error: `Debe ser uno de: ${ADMINISTRATOR_STATUSES.join(", ")}` }),
};

export const createAdministratorSchema = z.strictObject({
  fullName: fields.fullName,
  documentType: fields.documentType,
  documentNumber: fields.documentNumber,
  email: fields.email,
  phone: fields.phone.exactOptional(),
  position: fields.position,
  status: fields.status.exactOptional(),
}) satisfies z.ZodType<CreateAdministratorInput>;

export const updateAdministratorSchema = z.strictObject({
  fullName: fields.fullName.exactOptional(),
  documentType: fields.documentType.exactOptional(),
  documentNumber: fields.documentNumber.exactOptional(),
  email: fields.email.exactOptional(),
  phone: fields.phone.exactOptional(),
  position: fields.position.exactOptional(),
  status: fields.status.exactOptional(),
}) satisfies z.ZodType<UpdateAdministratorInput>;
