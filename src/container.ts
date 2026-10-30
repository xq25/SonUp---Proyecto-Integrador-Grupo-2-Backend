import "dotenv/config";

// Raíz de composición: único lugar donde las implementaciones concretas
// (Prisma, cliente HTTP del módulo administrativo) se conectan con los servicios, que solo conocen interfaces.
// Para cambiar de ORM o usar dobles de prueba basta con cambiar este archivo.
import { createPrismaClient, type PrismaClient } from "./shared/infrastructure/prisma/prisma.client.js";

import { AccessService } from "./access/application/access.service.js";
import {
  PrismaAppRepository,
  PrismaRoleRepository,
  PrismaUserRoleRepository,
} from "./access/infrastructure/prisma-access.repository.js";
import { AuthService } from "./auth/application/auth.service.js";
import {
  administrativeAuthConfigFromEnv,
  HttpAdministrativeAuthGateway,
} from "./auth/infrastructure/http-administrative-auth.gateway.js";
import { AdministrativeService } from "./administrative/application/administrative.service.js";
import {
  PrismaChildReader,
  PrismaGuardianReader,
  PrismaProfessionalReader,
} from "./administrative/infrastructure/prisma-administrative.readers.js";
import { AdministratorsService } from "./administrators/application/administrators.service.js";
import { PrismaAdministratorRepository } from "./administrators/infrastructure/prisma-administrator.repository.js";
import { EvaluationsService } from "./evaluations/application/evaluations.service.js";
import { GradingService } from "./evaluations/application/grading.service.js";
import {
  PrismaEvaluationScaleRepository,
  PrismaEvaluationSkillRepository,
} from "./evaluations/infrastructure/prisma-evaluation.repository.js";
import { CredentialsService } from "./evidences/application/credentials.service.js";
import { EvidencesService } from "./evidences/application/evidences.service.js";
import {
  PrismaCredentialRepository,
  PrismaEvidenceRepository,
  PrismaStudentEvidenceRepository,
} from "./evidences/infrastructure/prisma-evidence.repository.js";
import { ProfilesService } from "./profiles/application/profiles.service.js";
import { PrismaProfileRepository } from "./profiles/infrastructure/prisma-profile.repository.js";
import { SkillsService } from "./skills/application/skills.service.js";
import {
  PrismaSkillCategoryRepository,
  PrismaSkillRepository,
  PrismaStudentSkillRepository,
} from "./skills/infrastructure/prisma-skill.repository.js";
import { AttendanceService } from "./workshops/application/attendance.service.js";
import { WorkshopsService } from "./workshops/application/workshops.service.js";
import {
  PrismaWorkshopAttendanceRepository,
  PrismaWorkshopRepository,
  PrismaWorkshopSkillRepository,
} from "./workshops/infrastructure/prisma-workshop.repository.js";

export function createContainer(prisma: PrismaClient = createPrismaClient()) {
  // Lectores del módulo administrativo (solo lectura).
  const childReader = new PrismaChildReader(prisma);
  const guardianReader = new PrismaGuardianReader(prisma);
  const professionalReader = new PrismaProfessionalReader(prisma);

  // Repositorios compartidos entre servicios.
  const profileRepository = new PrismaProfileRepository(prisma);
  const skillRepository = new PrismaSkillRepository(prisma);
  const workshopRepository = new PrismaWorkshopRepository(prisma);
  const workshopSkillRepository = new PrismaWorkshopSkillRepository(prisma);
  const attendanceRepository = new PrismaWorkshopAttendanceRepository(prisma);
  const scaleRepository = new PrismaEvaluationScaleRepository(prisma);
  const studentSkillRepository = new PrismaStudentSkillRepository(prisma);
  const evaluationSkillRepository = new PrismaEvaluationSkillRepository(prisma);

  // Recálculo de calificaciones: lo usan evaluaciones, asistencias y talleres.
  const grading = new GradingService(evaluationSkillRepository, scaleRepository, studentSkillRepository);

  return {
    prisma,
    // Autenticación delegada al módulo administrativo (ADR-003)
    auth: new AuthService(new HttpAdministrativeAuthGateway(administrativeAuthConfigFromEnv())),
    // Acceso
    profiles: new ProfilesService(profileRepository),
    access: new AccessService(
      new PrismaAppRepository(prisma),
      new PrismaRoleRepository(prisma),
      new PrismaUserRoleRepository(prisma),
      profileRepository,
    ),
    // Módulo administrativo (solo lectura) y administrativos (provisional)
    administrative: new AdministrativeService(childReader, guardianReader, professionalReader),
    administrators: new AdministratorsService(new PrismaAdministratorRepository(prisma)),
    // Habilidades
    skills: new SkillsService(
      new PrismaSkillCategoryRepository(prisma),
      skillRepository,
      studentSkillRepository,
      scaleRepository,
      childReader,
    ),
    evaluations: new EvaluationsService(
      scaleRepository,
      evaluationSkillRepository,
      attendanceRepository,
      workshopSkillRepository,
      grading,
      childReader,
      workshopRepository,
    ),
    // Talleres
    workshops: new WorkshopsService(
      workshopRepository,
      workshopSkillRepository,
      skillRepository,
      professionalReader,
      grading,
    ),
    attendance: new AttendanceService(attendanceRepository, workshopRepository, childReader, grading),
    // Evidencias
    evidences: new EvidencesService(
      new PrismaEvidenceRepository(prisma),
      new PrismaStudentEvidenceRepository(prisma),
      childReader,
    ),
    credentials: new CredentialsService(
      new PrismaCredentialRepository(prisma),
      workshopRepository,
      attendanceRepository,
      childReader,
    ),
  };
}

export type Container = ReturnType<typeof createContainer>;
