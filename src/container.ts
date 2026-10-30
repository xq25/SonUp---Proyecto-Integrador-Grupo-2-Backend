import "dotenv/config";

// Raíz de composición: único lugar donde las implementaciones concretas
// (Prisma, cliente HTTP del módulo administrativo) se conectan con los servicios, que solo conocen interfaces.
// Para cambiar de ORM o usar dobles de prueba basta con cambiar este archivo.
import { createPrismaClient, type PrismaClient } from "./shared/infrastructure/prisma/prisma.client.js";

import { AppsService } from "./access/application/apps.service.js";
import { RolesService } from "./access/application/roles.service.js";
import { UserRolesService } from "./access/application/user-roles.service.js";
import { PrismaAppRepository } from "./access/infrastructure/prisma-app.repository.js";
import { PrismaRoleRepository } from "./access/infrastructure/prisma-role.repository.js";
import { PrismaUserRoleRepository } from "./access/infrastructure/prisma-user-role.repository.js";
import { ChildrenService } from "./administrative/application/children.service.js";
import { GuardiansService } from "./administrative/application/guardians.service.js";
import { ProfessionalsService } from "./administrative/application/professionals.service.js";
import { PrismaChildReader } from "./administrative/infrastructure/prisma-child.reader.js";
import { PrismaChildGuardianReader } from "./administrative/infrastructure/prisma-child-guardian.reader.js";
import { PrismaGuardianReader } from "./administrative/infrastructure/prisma-guardian.reader.js";
import { PrismaProfessionalReader } from "./administrative/infrastructure/prisma-professional.reader.js";
import { AdministratorsService } from "./administrators/application/administrators.service.js";
import { PrismaAdministratorRepository } from "./administrators/infrastructure/prisma-administrator.repository.js";
import { AuthService } from "./auth/application/auth.service.js";
import {
  administrativeAuthConfigFromEnv,
  HttpAdministrativeAuthGateway,
} from "./auth/infrastructure/http-administrative-auth.gateway.js";
import { EvaluationScalesService } from "./evaluations/application/evaluation-scales.service.js";
import { EvaluationsService } from "./evaluations/application/evaluations.service.js";
import { GradingService } from "./evaluations/application/grading.service.js";
import { PrismaEvaluationScaleRepository } from "./evaluations/infrastructure/prisma-evaluation-scale.repository.js";
import { PrismaEvaluationSkillRepository } from "./evaluations/infrastructure/prisma-evaluation-skill.repository.js";
import { CredentialsService } from "./evidences/application/credentials.service.js";
import { EvidencesService } from "./evidences/application/evidences.service.js";
import { StudentEvidencesService } from "./evidences/application/student-evidences.service.js";
import { PrismaCredentialRepository } from "./evidences/infrastructure/prisma-credential.repository.js";
import { PrismaEvidenceRepository } from "./evidences/infrastructure/prisma-evidence.repository.js";
import { PrismaStudentEvidenceRepository } from "./evidences/infrastructure/prisma-student-evidence.repository.js";
import { ProfilesService } from "./profiles/application/profiles.service.js";
import { PrismaProfileRepository } from "./profiles/infrastructure/prisma-profile.repository.js";
import { SkillCategoriesService } from "./skills/application/skill-categories.service.js";
import { SkillsService } from "./skills/application/skills.service.js";
import { StudentSkillsService } from "./skills/application/student-skills.service.js";
import { PrismaSkillCategoryRepository } from "./skills/infrastructure/prisma-skill-category.repository.js";
import { PrismaSkillRepository } from "./skills/infrastructure/prisma-skill.repository.js";
import { PrismaStudentSkillRepository } from "./skills/infrastructure/prisma-student-skill.repository.js";
import { AttendanceService } from "./workshops/application/attendance.service.js";
import { WorkshopSkillsService } from "./workshops/application/workshop-skills.service.js";
import { WorkshopsService } from "./workshops/application/workshops.service.js";
import { PrismaWorkshopAttendanceRepository } from "./workshops/infrastructure/prisma-workshop-attendance.repository.js";
import { PrismaWorkshopSkillRepository } from "./workshops/infrastructure/prisma-workshop-skill.repository.js";
import { PrismaWorkshopRepository } from "./workshops/infrastructure/prisma-workshop.repository.js";

export function createContainer(prisma: PrismaClient = createPrismaClient()) {
  // Lectores del módulo administrativo (solo lectura).
  const childReader = new PrismaChildReader(prisma);
  const childGuardianReader = new PrismaChildGuardianReader(prisma);
  const professionalReader = new PrismaProfessionalReader(prisma);

  // Repositorios compartidos entre servicios.
  const appRepository = new PrismaAppRepository(prisma);
  const roleRepository = new PrismaRoleRepository(prisma);
  const profileRepository = new PrismaProfileRepository(prisma);
  const skillCategoryRepository = new PrismaSkillCategoryRepository(prisma);
  const skillRepository = new PrismaSkillRepository(prisma);
  const studentSkillRepository = new PrismaStudentSkillRepository(prisma);
  const scaleRepository = new PrismaEvaluationScaleRepository(prisma);
  const evaluationSkillRepository = new PrismaEvaluationSkillRepository(prisma);
  const workshopRepository = new PrismaWorkshopRepository(prisma);
  const workshopSkillRepository = new PrismaWorkshopSkillRepository(prisma);
  const attendanceRepository = new PrismaWorkshopAttendanceRepository(prisma);
  const evidenceRepository = new PrismaEvidenceRepository(prisma);

  // Recálculo de calificaciones: lo usan evaluaciones, asistencias y habilidades de talleres.
  const grading = new GradingService(evaluationSkillRepository, scaleRepository, studentSkillRepository);

  return {
    prisma,
    // Autenticación delegada al módulo administrativo (ADR-003)
    auth: new AuthService(new HttpAdministrativeAuthGateway(administrativeAuthConfigFromEnv())),
    // Acceso
    profiles: new ProfilesService(profileRepository),
    apps: new AppsService(appRepository),
    roles: new RolesService(roleRepository),
    userRoles: new UserRolesService(
      new PrismaUserRoleRepository(prisma),
      roleRepository,
      appRepository,
      profileRepository,
    ),
    // Módulo administrativo (solo lectura) y administrativos (provisional)
    children: new ChildrenService(childReader, childGuardianReader),
    guardians: new GuardiansService(new PrismaGuardianReader(prisma), childGuardianReader),
    professionals: new ProfessionalsService(professionalReader),
    administrators: new AdministratorsService(new PrismaAdministratorRepository(prisma)),
    // Habilidades
    skillCategories: new SkillCategoriesService(skillCategoryRepository, skillRepository),
    skills: new SkillsService(skillRepository, skillCategoryRepository),
    studentSkills: new StudentSkillsService(studentSkillRepository, scaleRepository, childReader),
    // Evaluaciones
    evaluationScales: new EvaluationScalesService(scaleRepository),
    evaluations: new EvaluationsService(
      evaluationSkillRepository,
      scaleRepository,
      attendanceRepository,
      workshopSkillRepository,
      grading,
      childReader,
      workshopRepository,
    ),
    // Talleres
    workshops: new WorkshopsService(workshopRepository, workshopSkillRepository, professionalReader),
    workshopSkills: new WorkshopSkillsService(workshopSkillRepository, workshopRepository, skillRepository, grading),
    attendance: new AttendanceService(attendanceRepository, workshopRepository, childReader, grading),
    // Evidencias
    evidences: new EvidencesService(evidenceRepository, childReader),
    studentEvidences: new StudentEvidencesService(
      new PrismaStudentEvidenceRepository(prisma),
      evidenceRepository,
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
