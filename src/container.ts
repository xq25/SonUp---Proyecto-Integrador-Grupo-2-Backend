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
import { StaffService } from "./administrative/application/staff.service.js";
import { PrismaChildReader } from "./administrative/infrastructure/prisma-child.reader.js";
import { PrismaChildGuardianReader } from "./administrative/infrastructure/prisma-child-guardian.reader.js";
import { PrismaGuardianReader } from "./administrative/infrastructure/prisma-guardian.reader.js";
import { PrismaProfessionalReader } from "./administrative/infrastructure/prisma-professional.reader.js";
import { PrismaStaffReader } from "./administrative/infrastructure/prisma-staff.reader.js";
import { SagaChildReader } from "./administrative/infrastructure/saga/saga-child.reader.js";
import { SagaChildGuardianReader } from "./administrative/infrastructure/saga/saga-child-guardian.reader.js";
import { SagaGuardianReader } from "./administrative/infrastructure/saga/saga-guardian.reader.js";
import { SagaHttpClient, sagaConfigFromEnv } from "./administrative/infrastructure/saga/saga-http.client.js";
import { SagaProfessionalReader } from "./administrative/infrastructure/saga/saga-professional.reader.js";
import { SagaStaffReader } from "./administrative/infrastructure/saga/saga-staff.reader.js";
import { RequestSagaTokenSource } from "./administrative/infrastructure/saga/saga-token.source.js";
import { AccessPolicy } from "./auth/application/access-policy.js";
import { AuthService } from "./auth/application/auth.service.js";
import { ServiceSession } from "./auth/application/service-session.js";
import type { AuthGateway } from "./auth/domain/auth.gateway.js";
import type { TokenVerifier } from "./auth/domain/token-verifier.js";
import { ActorLinksService } from "./auth/application/actor-links.service.js";
import { JwtTokenVerifier, jwtSecretFromEnv, UnconfiguredTokenVerifier } from "./auth/infrastructure/jwt-token.verifier.js";
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

/**
 * Lectores del módulo administrativo (solo lectura, ADR-007): con `SAGA_API_URL`
 * se consulta la API de Saga con el usuario de servicio; sin ella, las tablas
 * simuladas del esquema `administrativo` (desarrollo y pruebas).
 */
function createAdministrativeReaders(prisma: PrismaClient, authGateway: AuthGateway) {
  const saga = sagaConfigFromEnv();
  if (!saga.baseUrl) {
    return {
      source: "bd-simulada" as const,
      children: new PrismaChildReader(prisma),
      guardians: new PrismaGuardianReader(prisma),
      childGuardians: new PrismaChildGuardianReader(prisma),
      professionals: new PrismaProfessionalReader(prisma),
      staff: new PrismaStaffReader(prisma),
    };
  }
  // Con cada petición viaja el token del usuario; el de servicio queda para scripts y desarrollo.
  const tokens = new RequestSagaTokenSource(new ServiceSession(authGateway, saga.credentials, saga.token));
  const client = new SagaHttpClient(saga, tokens);
  const children = new SagaChildReader(client);
  const guardians = new SagaGuardianReader(client);
  return {
    source: "saga" as const,
    children,
    guardians,
    childGuardians: new SagaChildGuardianReader(client, children, guardians),
    professionals: new SagaProfessionalReader(client),
    staff: new SagaStaffReader(client),
  };
}

/**
 * Verificación local del token del servicio de seguridad con `JWT_SECRET` (ADR-008).
 * En producción el secreto es obligatorio: sin él la API no arranca.
 */
function createTokenVerifier(env: NodeJS.ProcessEnv = process.env): { mode: "jwt" | "sin-secreto"; verifier: TokenVerifier } {
  const secret = jwtSecretFromEnv(env);
  if (secret) return { mode: "jwt", verifier: new JwtTokenVerifier(secret) };
  if (env["NODE_ENV"] === "production") {
    throw new Error("Falta JWT_SECRET: es obligatorio en producción para verificar los tokens del servicio de seguridad");
  }
  return { mode: "sin-secreto", verifier: new UnconfiguredTokenVerifier() };
}

/** Segundos que se reutiliza el enlace usuario ↔ persona de Saga (`AUTH_LINK_CACHE_SECONDS`, por defecto 300). */
function linkCacheSecondsFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env["AUTH_LINK_CACHE_SECONDS"];
  const seconds = Number(raw);
  return raw !== undefined && raw.trim() !== "" && Number.isFinite(seconds) && seconds >= 0 ? seconds : 300;
}

export function createContainer(prisma: PrismaClient = createPrismaClient()) {
  // Login del módulo administrativo: lo usan el front (AuthService) y este backend (sesión de servicio).
  const authGateway = new HttpAdministrativeAuthGateway(administrativeAuthConfigFromEnv());
  // Lectores del módulo administrativo (solo lectura).
  const administrative = createAdministrativeReaders(prisma, authGateway);
  // Quién hace cada petición y con qué roles.
  const tokens = createTokenVerifier();
  const childReader = administrative.children;
  const childGuardianReader = administrative.childGuardians;
  const professionalReader = administrative.professionals;

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
  const studentEvidenceRepository = new PrismaStudentEvidenceRepository(prisma);
  const credentialRepository = new PrismaCredentialRepository(prisma);

  // Recálculo de calificaciones: lo usan evaluaciones, asistencias y habilidades de talleres.
  const grading = new GradingService(evaluationSkillRepository, scaleRepository, studentSkillRepository);
  // Enlace usuario ↔ persona de Saga (`security_user_id` = `sub`): lo usan la política de acceso y el login.
  const actorLinks = new ActorLinksService(
    administrative.staff,
    professionalReader,
    childReader,
    administrative.guardians,
    linkCacheSecondsFromEnv(),
  );

  return {
    prisma,
    /** De dónde se leen los datos del módulo administrativo: `saga` o `bd-simulada`. */
    administrativeSource: administrative.source,
    /** Verificación de tokens: `jwt` (con JWT_SECRET) o `sin-secreto` (solo desarrollo: todo token se rechaza). */
    authMode: tokens.mode,
    tokenVerifier: tokens.verifier,
    /** A qué registros accede cada usuario dentro de las rutas que su rol permite (ADR-008). */
    access: new AccessPolicy(
      workshopRepository,
      attendanceRepository,
      childGuardianReader,
      credentialRepository,
      studentEvidenceRepository,
      actorLinks,
    ),
    // Autenticación delegada al módulo administrativo (ADR-003); login y perfil con los ids de Saga (ADR-008)
    auth: new AuthService(authGateway, { tokens: tokens.verifier, links: actorLinks, childGuardians: childGuardianReader }),
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
    // Módulo administrativo (solo lectura)
    children: new ChildrenService(childReader, childGuardianReader),
    guardians: new GuardiansService(administrative.guardians, childGuardianReader),
    professionals: new ProfessionalsService(professionalReader),
    staff: new StaffService(administrative.staff),
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
      studentEvidenceRepository,
      evidenceRepository,
      childReader,
    ),
    credentials: new CredentialsService(
      credentialRepository,
      workshopRepository,
      attendanceRepository,
      childReader,
    ),
  };
}

export type Container = ReturnType<typeof createContainer>;
