import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const identifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/);

export const registrationSchema = z.object({
  name: text(100),
  email: z.string().trim().email().max(254),
  password: z.string()
    .min(12)
    .max(72)
    .refine((password) => Buffer.byteLength(password, "utf8") <= 72, "Password must be at most 72 bytes"),
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(72)
    .refine((password) => Buffer.byteLength(password, "utf8") <= 72, "Password must be at most 72 bytes"),
}).strict();

const lessonSchema = z.object({
  id: identifier,
  title: text(200),
  titleAr: text(200),
  content: text(20_000),
  contentAr: text(20_000),
  duration: z.number().int().min(1).max(600),
}).strict();

export const courseSchema = z.object({
  id: identifier,
  title: text(200),
  titleAr: text(200),
  category: text(100),
  categoryAr: text(100),
  instructor: text(150),
  instructorAr: text(150),
  description: text(5_000),
  descriptionAr: text(5_000),
  level: text(50),
  image: z.string().url().max(2_000),
  lessons: z.array(lessonSchema).max(200),
}).strict().superRefine((course, context) => {
  const ids = new Set<string>();
  course.lessons.forEach((lesson, index) => {
    if (ids.has(lesson.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lessons", index, "id"],
        message: "Lesson IDs must be unique within a course",
      });
    }
    ids.add(lesson.id);
  });
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CourseInput = z.infer<typeof courseSchema>;
