import "dotenv/config";
import { Pool } from "pg";
import { getDatabaseUrl } from "./database.js";
import { seedCourses } from "./seed-data.js";

let pool: Pool | undefined;

try {
  pool = new Pool({ connectionString: getDatabaseUrl(), max: 2, application_name: "lms-seed" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const course of seedCourses) {
      await client.query(
        `INSERT INTO courses (id, title, title_ar, category, category_ar, instructor,
          instructor_ar, description, description_ar, level, image)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [
          course.id, course.title, course.titleAr, course.category, course.categoryAr,
          course.instructor, course.instructorAr, course.description, course.descriptionAr,
          course.level, course.image,
        ],
      );
      for (const [position, lesson] of course.lessons.entries()) {
        await client.query(
          `INSERT INTO lessons (id, course_id, title, title_ar, content, content_ar, duration, position)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
          [lesson.id, course.id, lesson.title, lesson.titleAr, lesson.content, lesson.contentAr, lesson.duration, position],
        );
      }
    }
    await client.query("COMMIT");
    console.log(`Seeded ${seedCourses.length} demo courses. Existing IDs were left unchanged.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} catch (error) {
  console.error("Database seeding failed", error instanceof Error ? error.message : "Unexpected error");
  process.exitCode = 1;
} finally {
  await pool?.end();
}
