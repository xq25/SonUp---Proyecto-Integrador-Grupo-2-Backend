import type { ActorId } from "../../shared/domain/auditable.js";
import type {
  CreateSkillCategoryInput,
  CreateSkillInput,
  SetStudentSkillInput,
  Skill,
  SkillCategory,
  SkillFilter,
  StudentSkill,
  StudentSkillGrade,
  UpdateSkillCategoryInput,
  UpdateSkillInput,
} from "./skill.entity.js";

export interface SkillCategoryRepository {
  findById(id: bigint): Promise<SkillCategory | null>;
  /** Sin distinguir mayúsculas. Incluye eliminadas: el nombre es único en toda la tabla. */
  findByName(name: string): Promise<SkillCategory | null>;
  findAll(): Promise<SkillCategory[]>;
  create(data: CreateSkillCategoryInput, actor: ActorId): Promise<SkillCategory>;
  update(id: bigint, data: UpdateSkillCategoryInput, actor: ActorId): Promise<SkillCategory>;
  /** Borrado lógico. */
  delete(id: bigint, actor: ActorId): Promise<void>;
}

export interface SkillRepository {
  findById(id: bigint): Promise<Skill | null>;
  /**
   * Habilidad con ese nombre en la categoría, sin distinguir mayúsculas.
   * Incluye eliminadas: el nombre es único por categoría en toda la tabla.
   */
  findByName(skillCategoryId: bigint, name: string): Promise<Skill | null>;
  /** ¿Tiene evaluaciones en talleres o calificaciones de estudiantes vigentes? */
  hasGradeHistory(id: bigint): Promise<boolean>;
  findMany(filter?: SkillFilter): Promise<Skill[]>;
  /** ¿La categoría tiene habilidades vigentes? */
  existsInCategory(skillCategoryId: bigint): Promise<boolean>;
  create(data: CreateSkillInput, actor: ActorId): Promise<Skill>;
  update(id: bigint, data: UpdateSkillInput, actor: ActorId): Promise<Skill>;
  /** Borrado lógico. */
  delete(id: bigint, actor: ActorId): Promise<void>;
}

export interface StudentSkillRepository {
  /** Registro vigente (no eliminado). */
  find(studentId: bigint, skillId: bigint): Promise<StudentSkill | null>;
  findByStudent(studentId: bigint): Promise<StudentSkill[]>;
  /** Calificaciones vigentes del estudiante con categoría y `numValue` (habilidades y categorías no eliminadas). */
  findGrades(studentId: bigint): Promise<StudentSkillGrade[]>;
  /** Crea, actualiza o restaura el registro (único por estudiante y habilidad). */
  upsert(data: SetStudentSkillInput, actor: ActorId): Promise<StudentSkill>;
  /** Borrado lógico. */
  delete(id: bigint, actor: ActorId): Promise<void>;
}
