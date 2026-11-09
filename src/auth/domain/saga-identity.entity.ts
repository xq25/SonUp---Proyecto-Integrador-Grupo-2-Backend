// A quién de Saga corresponde la cuenta, según su rol (ADR-008). Se entrega al
// front en el login y en el perfil para que sepa con qué ids consultar "lo suyo".

export interface SagaIdentity {
  /** `true` si la cuenta está enlazada con al menos un registro de Saga (`security_user_id`). */
  linked: boolean;
  /** TALLERISTA: su `professional_id` (el `evaluatorId` de sus talleres). */
  professionalId: bigint | null;
  /** TALLERISTA: su `staff_id`. */
  staffId: bigint | null;
  /** ESTUDIANTE: su `child_id` (el `studentId` de nuestras rutas). */
  childId: bigint | null;
  /** ACUDIENTE: su `guardian_id`. */
  guardianId: bigint | null;
  /** ACUDIENTE: sus jóvenes con vínculo vigente (`child_id`). */
  childIds: bigint[];
}
