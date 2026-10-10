import type { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import type { Course, Lesson, User } from "./seed-data.js";

export interface LessonProgress {
  courseId: string;
  enrolled: boolean;
  completedLessonIds: string[];
  progressPercent: number;
}

export interface AdminStats {
  courseCount: number;
  lessonCount: number;
  enrollmentCount: number;
  studentCount: number;
}

export interface AdminStudentCourse {
  courseId: string;
  title: string;
  titleAr: string;
  courseEnrollmentCount: number;
  lessonCount: number;
  completedLessonCount: number;
  progressPercent: number;
}

export interface AdminStudent {
  name: string;
  email: string;
  enrollmentCount: number;
  courses: AdminStudentCourse[];
}

export interface LmsRepository {
  createUser(name: string, email: string, passwordHash: string): Promise<User>;
  createAdmin(name: string, email: string, passwordHash: string): Promise<User>;
  findUserByEmail(email: string): Promise<(User & { passwordHash: string }) | null>;
  findUserById(id: string): Promise<User | null>;
  listCourses(search: string, category: string, userId?: string): Promise<Course[]>;
  getCourse(courseId: string, userId?: string): Promise<Course | null>;
  getLesson(lessonId: string, userId?: string): Promise<(Lesson & { courseId: string }) | null>;
  enroll(userId: string, courseId: string): Promise<boolean>;
  isEnrolled(userId: string, courseId: string): Promise<boolean>;
  listEnrollments(userId: string): Promise<string[]>;
  getProgress(userId: string, courseId?: string): Promise<LessonProgress[]>;
  listAdminStudents(): Promise<AdminStudent[]>;
  completeLesson(userId: string, courseId: string, lessonId: string): Promise<boolean>;
  getAdminStats(): Promise<AdminStats>;
  createCourse(course: Course): Promise<void>;
  updateCourse(course: Course): Promise<boolean>;
  deleteCourse(courseId: string): Promise<boolean>;
}

type CourseRow = Omit<Course, "lessons">;
type LessonRow = Lesson & { courseId: string; position: number };
type CourseCatalogRow = CourseRow & {
  lessonId: string | null;
  lessonTitle: string | null;
  lessonTitleAr: string | null;
  lessonDuration: number | null;
  completed: boolean | null;
};
type UserRow = { id: string; name: string; email: string; role: "student" | "admin"; passwordHash?: string };

const userColumns = `id, name, email, role`;
const courseColumns = `c.id, c.title, c.title_ar AS "titleAr", c.category, c.category_ar AS "categoryAr",
  c.instructor, c.instructor_ar AS "instructorAr", c.description, c.description_ar AS "descriptionAr",
  c.level, c.image`;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

async function withTransaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function attachLessons(
  pool: Pool,
  rows: CourseRow[],
  userId?: string,
  includeContent = true,
): Promise<Course[]> {
  if (rows.length === 0) return [];
  const contentColumns = includeContent
    ? `l.content, l.content_ar AS "contentAr",`
    : `''::text AS content, ''::text AS "contentAr",`;
  const lessons = await pool.query<LessonRow>(
    `SELECT l.id, l.course_id AS "courseId", l.title, l.title_ar AS "titleAr",
      ${contentColumns} l.duration, l.position,
      ($2::uuid IS NOT NULL AND p.completed_at IS NOT NULL) AS completed
     FROM lessons l
     LEFT JOIN lesson_progress p ON p.lesson_id = l.id AND p.user_id = $2
     WHERE l.course_id = ANY($1::text[])
     ORDER BY l.course_id, l.position`,
    [rows.map(({ id }) => id), userId ?? null],
  );
  const byCourse = new Map<string, Lesson[]>();
  for (const lesson of lessons.rows) {
    const { courseId, position: _position, ...publicLesson } = lesson;
    const group = byCourse.get(courseId) ?? [];
    group.push(publicLesson);
    byCourse.set(courseId, group);
  }
  return rows.map((row) => ({ ...row, lessons: byCourse.get(row.id) ?? [] }));
}

export class PostgresRepository implements LmsRepository {
  constructor(private readonly pool: Pool) {}

  async createUser(name: string, email: string, passwordHash: string): Promise<User> {
    const result = await this.pool.query<UserRow>(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'student')
       RETURNING ${userColumns}`,
      [randomUUID(), name, email, passwordHash],
    );
    return result.rows[0]!;
  }

  async createAdmin(name: string, email: string, passwordHash: string): Promise<User> {
    const result = await this.pool.query<UserRow>(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin')
       RETURNING ${userColumns}`,
      [randomUUID(), name, email, passwordHash],
    );
    return result.rows[0]!;
  }

  async findUserByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
    const result = await this.pool.query<UserRow & { passwordHash: string }>(
      `SELECT ${userColumns}, password_hash AS "passwordHash" FROM users WHERE email = $1`,
      [email],
    );
    return result.rows[0] ?? null;
  }

  async findUserById(id: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT ${userColumns} FROM users WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async listCourses(search: string, category: string, userId?: string): Promise<Course[]> {
    const pattern = `%${escapeLike(search)}%`;
    const result = await this.pool.query<CourseCatalogRow>(
      `SELECT ${courseColumns}, l.id AS "lessonId", l.title AS "lessonTitle",
        l.title_ar AS "lessonTitleAr", l.duration AS "lessonDuration",
        ($4::uuid IS NOT NULL AND p.completed_at IS NOT NULL) AS completed
       FROM courses c
       LEFT JOIN lessons l ON l.course_id = c.id
       LEFT JOIN lesson_progress p ON p.lesson_id = l.id AND p.user_id = $4
       WHERE ($1 = '' OR c.title ILIKE $2 ESCAPE '\\' OR c.title_ar ILIKE $2 ESCAPE '\\')
         AND ($3 = '' OR lower(c.category) = lower($3) OR c.category_ar = $3)
       ORDER BY c.title, l.position`,
      [search, pattern, category, userId ?? null],
    );
    const coursesById = new Map<string, Course>();
    for (const row of result.rows) {
      let course = coursesById.get(row.id);
      if (!course) {
        const { lessonId: _lessonId, lessonTitle: _lessonTitle, lessonTitleAr: _lessonTitleAr,
          lessonDuration: _lessonDuration, completed: _completed, ...courseRow } = row;
        course = { ...courseRow, lessons: [] };
        coursesById.set(course.id, course);
      }
      if (row.lessonId !== null) {
        course.lessons.push({
          id: row.lessonId,
          title: row.lessonTitle!,
          titleAr: row.lessonTitleAr!,
          content: "",
          contentAr: "",
          duration: row.lessonDuration!,
          completed: row.completed ?? false,
        });
      }
    }
    return [...coursesById.values()];
  }

  async getCourse(courseId: string, userId?: string): Promise<Course | null> {
    const result = await this.pool.query<CourseRow>(
      `SELECT ${courseColumns} FROM courses c WHERE c.id = $1`,
      [courseId],
    );
    const [course] = await attachLessons(this.pool, result.rows, userId);
    return course ?? null;
  }

  async getLesson(lessonId: string, userId?: string): Promise<(Lesson & { courseId: string }) | null> {
    const result = await this.pool.query<LessonRow>(
      `SELECT l.id, l.course_id AS "courseId", l.title, l.title_ar AS "titleAr",
        l.content, l.content_ar AS "contentAr", l.duration, l.position,
        ($2::uuid IS NOT NULL AND p.completed_at IS NOT NULL) AS completed
       FROM lessons l
       LEFT JOIN lesson_progress p ON p.lesson_id = l.id AND p.user_id = $2
       WHERE l.id = $1`,
      [lessonId, userId ?? null],
    );
    if (!result.rows[0]) return null;
    const { position: _position, ...lesson } = result.rows[0];
    return lesson;
  }

  async enroll(userId: string, courseId: string): Promise<boolean> {
    const result = await this.pool.query(
      `INSERT INTO enrollments (user_id, course_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, course_id) DO NOTHING
       RETURNING course_id`,
      [userId, courseId],
    );
    return result.rowCount === 1;
  }

  async isEnrolled(userId: string, courseId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2`,
      [userId, courseId],
    );
    return result.rowCount === 1;
  }

  async listEnrollments(userId: string): Promise<string[]> {
    const result = await this.pool.query<{ courseId: string }>(
      `SELECT course_id AS "courseId" FROM enrollments WHERE user_id = $1 ORDER BY enrolled_at`,
      [userId],
    );
    return result.rows.map(({ courseId }) => courseId);
  }

  async getProgress(userId: string, courseId?: string): Promise<LessonProgress[]> {
    const result = await this.pool.query<{
      courseId: string;
      enrolled: boolean;
      completedLessonIds: string[] | null;
      lessonCount: string;
    }>(
      `SELECT c.id AS "courseId", (e.user_id IS NOT NULL) AS enrolled,
        COALESCE(array_agg(p.lesson_id) FILTER (WHERE p.lesson_id IS NOT NULL), '{}') AS "completedLessonIds",
        count(l.id)::text AS "lessonCount"
       FROM courses c
       LEFT JOIN enrollments e ON e.course_id = c.id AND e.user_id = $1
       LEFT JOIN lessons l ON l.course_id = c.id
       LEFT JOIN lesson_progress p ON p.lesson_id = l.id AND p.user_id = $1
       WHERE ($2::text IS NULL OR c.id = $2)
       GROUP BY c.id, e.user_id
       ORDER BY c.title`,
      [userId, courseId ?? null],
    );
    return result.rows.map((row) => {
      const completedLessonIds = row.completedLessonIds ?? [];
      const lessonCount = Number(row.lessonCount);
      return {
        courseId: row.courseId,
        enrolled: row.enrolled,
        completedLessonIds,
        progressPercent: lessonCount === 0 ? 0 : Math.round((completedLessonIds.length / lessonCount) * 100),
      };
    });
  }

  async listAdminStudents(): Promise<AdminStudent[]> {
    const result = await this.pool.query<AdminStudent>(
      `WITH student_course_progress AS (
         SELECT e.user_id, c.id AS "courseId", c.title, c.title_ar AS "titleAr",
           (SELECT count(*)::int FROM enrollments ce WHERE ce.course_id = c.id) AS "courseEnrollmentCount",
           count(DISTINCT l.id)::int AS "lessonCount",
           count(DISTINCT lp.lesson_id)::int AS "completedLessonCount"
         FROM enrollments e
         JOIN users u ON u.id = e.user_id AND u.role = 'student'
         JOIN courses c ON c.id = e.course_id
         LEFT JOIN lessons l ON l.course_id = c.id
         LEFT JOIN lesson_progress lp ON lp.user_id = e.user_id AND lp.lesson_id = l.id
         GROUP BY e.user_id, c.id
       )
       SELECT u.name, u.email, count(scp."courseId")::int AS "enrollmentCount",
         COALESCE(
           json_agg(json_build_object(
             'courseId', scp."courseId",
             'title', scp.title,
             'titleAr', scp."titleAr",
             'courseEnrollmentCount', scp."courseEnrollmentCount",
             'lessonCount', scp."lessonCount",
             'completedLessonCount', scp."completedLessonCount",
             'progressPercent', CASE WHEN scp."lessonCount" = 0 THEN 0
               ELSE round(scp."completedLessonCount" * 100.0 / scp."lessonCount")::int END
           ) ORDER BY scp.title) FILTER (WHERE scp."courseId" IS NOT NULL),
           '[]'::json
         ) AS courses
       FROM users u
       LEFT JOIN student_course_progress scp ON scp.user_id = u.id
       WHERE u.role = 'student'
       GROUP BY u.id
       ORDER BY u.name, u.email`,
    );
    return result.rows;
  }

  async completeLesson(userId: string, courseId: string, lessonId: string): Promise<boolean> {
    const result = await this.pool.query(
      `INSERT INTO lesson_progress (user_id, lesson_id, completed_at)
       SELECT $1, l.id, now()
       FROM lessons l
       JOIN enrollments e ON e.course_id = l.course_id AND e.user_id = $1
       WHERE l.id = $2 AND l.course_id = $3
       ON CONFLICT (user_id, lesson_id) DO UPDATE SET completed_at = now()
       RETURNING lesson_id`,
      [userId, lessonId, courseId],
    );
    return result.rowCount === 1;
  }

  async getAdminStats(): Promise<AdminStats> {
    const result = await this.pool.query<{
      courseCount: string;
      lessonCount: string;
      enrollmentCount: string;
      studentCount: string;
    }>(
      `SELECT
        (SELECT count(*) FROM courses)::text AS "courseCount",
        (SELECT count(*) FROM lessons)::text AS "lessonCount",
        (SELECT count(*) FROM enrollments)::text AS "enrollmentCount",
        (SELECT count(*) FROM users WHERE role = 'student')::text AS "studentCount"`,
    );
    const row = result.rows[0]!;
    return {
      courseCount: Number(row.courseCount),
      lessonCount: Number(row.lessonCount),
      enrollmentCount: Number(row.enrollmentCount),
      studentCount: Number(row.studentCount),
    };
  }

  async createCourse(course: Course): Promise<void> {
    await withTransaction(this.pool, async (client) => {
      await this.insertCourse(client, course);
      for (const [position, lesson] of course.lessons.entries()) {
        await this.insertLesson(client, course.id, lesson, position);
      }
    });
  }

  async updateCourse(course: Course): Promise<boolean> {
    return withTransaction(this.pool, async (client) => {
      const updated = await client.query(
        `UPDATE courses SET title = $2, title_ar = $3, category = $4, category_ar = $5,
          instructor = $6, instructor_ar = $7, description = $8, description_ar = $9,
          level = $10, image = $11, updated_at = now()
         WHERE id = $1`,
        [
          course.id, course.title, course.titleAr, course.category, course.categoryAr,
          course.instructor, course.instructorAr, course.description, course.descriptionAr,
          course.level, course.image,
        ],
      );
      if (updated.rowCount === 0) return false;
      const lessonIds = course.lessons.map(({ id }) => id);
      await client.query(
        `UPDATE lessons SET position = position + 200 WHERE course_id = $1`,
        [course.id],
      );
      await client.query(
        `DELETE FROM lessons WHERE course_id = $1 AND NOT (id = ANY($2::text[]))`,
        [course.id, lessonIds],
      );
      for (const [position, lesson] of course.lessons.entries()) {
        const saved = await this.upsertLesson(client, course.id, lesson, position);
        if (saved.rowCount === 0) {
          const error = new Error("Lesson ID is already used by another course") as Error & { code: string };
          error.code = "23505";
          throw error;
        }
      }
      return true;
    });
  }

  async deleteCourse(courseId: string): Promise<boolean> {
    const result = await this.pool.query(`DELETE FROM courses WHERE id = $1`, [courseId]);
    return result.rowCount === 1;
  }

  private async insertCourse(client: PoolClient, course: Course): Promise<void> {
    await client.query(
      `INSERT INTO courses (id, title, title_ar, category, category_ar, instructor,
        instructor_ar, description, description_ar, level, image)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        course.id, course.title, course.titleAr, course.category, course.categoryAr,
        course.instructor, course.instructorAr, course.description, course.descriptionAr,
        course.level, course.image,
      ],
    );
  }

  private async insertLesson(client: PoolClient, courseId: string, lesson: Lesson, position: number): Promise<void> {
    await client.query(
      `INSERT INTO lessons (id, course_id, title, title_ar, content, content_ar, duration, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [lesson.id, courseId, lesson.title, lesson.titleAr, lesson.content, lesson.contentAr, lesson.duration, position],
    );
  }

  private async upsertLesson(client: PoolClient, courseId: string, lesson: Lesson, position: number) {
    return client.query(
      `INSERT INTO lessons (id, course_id, title, title_ar, content, content_ar, duration, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, title_ar = EXCLUDED.title_ar,
         content = EXCLUDED.content, content_ar = EXCLUDED.content_ar,
         duration = EXCLUDED.duration, position = EXCLUDED.position
       WHERE lessons.course_id = EXCLUDED.course_id`,
      [lesson.id, courseId, lesson.title, lesson.titleAr, lesson.content, lesson.contentAr, lesson.duration, position],
    );
  }
}
