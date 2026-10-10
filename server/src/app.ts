import { randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import connectPgSimple from "connect-pg-simple";
import cors from "cors";
import express, {
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import session, { type Store } from "express-session";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import type { Pool } from "pg";
import { databaseErrorCode, HttpError } from "./errors.js";
import type { LmsRepository } from "./repository.js";
import type { User } from "./seed-data.js";
import { courseSchema, loginSchema, registrationSchema } from "./validation.js";

const PgSessionStore = connectPgSimple(session);
const dummyPasswordHash = bcrypt.hash("__unknown_lms_account_password__", 12);

export interface AppOptions {
  sessionSecret: string;
  frontendOrigin: string;
  cookieSecure: boolean;
  trustProxy?: boolean;
}

export function createPostgresSessionStore(pool: Pool): Store {
  return new PgSessionStore({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: false,
    pruneSessionInterval: 60 * 15,
  });
}

function asyncRoute(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}

function validate<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "Request validation failed",
      result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

function requireCsrf(request: Request, _response: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    next();
    return;
  }

  const expected = request.session.csrfToken;
  const actual = request.header("x-csrf-token");
  if (!expected || !actual) {
    next(new HttpError(403, "CSRF_FAILED", "A valid CSRF token is required"));
    return;
  }

  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  if (expectedBytes.length !== actualBytes.length || !timingSafeEqual(expectedBytes, actualBytes)) {
    next(new HttpError(403, "CSRF_FAILED", "A valid CSRF token is required"));
    return;
  }
  next();
}

function regenerateSession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error) => error ? reject(error) : resolve());
  });
}

function saveSession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.save((error) => error ? reject(error) : resolve());
  });
}

function safeUser(user: User): User {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function requireSignedIn(repository: LmsRepository): RequestHandler {
  return asyncRoute(async (request, _response, next) => {
    if (!request.session.userId) {
      throw new HttpError(401, "UNAUTHENTICATED", "Sign in is required");
    }
    const user = await repository.findUserById(request.session.userId);
    if (!user) {
      request.session.userId = undefined;
      throw new HttpError(401, "UNAUTHENTICATED", "Sign in is required");
    }
    request.currentUser = user;
    next();
  });
}

function requireRole(role: User["role"]): RequestHandler {
  return (request, _response, next) => {
    if (!request.currentUser) {
      next(new HttpError(401, "UNAUTHENTICATED", "Sign in is required"));
      return;
    }
    if (request.currentUser.role !== role) {
      next(new HttpError(403, "FORBIDDEN", "You do not have permission to perform this operation"));
      return;
    }
    next();
  };
}

function requireEnrolledCourse(repository: LmsRepository): RequestHandler {
  return asyncRoute(async (request, _response, next) => {
    const user = requireCurrentUser(request);
    const id = courseId(request);
    if (user.role !== "admin" && !await repository.isEnrolled(user.id, id)) {
      throw new HttpError(403, "ENROLLMENT_REQUIRED", "Enroll in this course to access its lessons");
    }
    next();
  });
}

function requireCurrentUser(request: Request): User {
  if (!request.currentUser) throw new HttpError(401, "UNAUTHENTICATED", "Sign in is required");
  return request.currentUser;
}

function courseId(request: Request): string {
  return routeParam(request.params.courseId, "courseId");
}

function routeParam(value: string | string[] | undefined, name: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new HttpError(400, "INVALID_PARAMETER", `Invalid ${name}`);
  }
  return value;
}

function notFound(message: string): never {
  throw new HttpError(404, "NOT_FOUND", message);
}

export function createApp(
  repository: LmsRepository,
  sessionStore: Store,
  options: AppOptions,
): express.Express {
  const app = express();
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED", message: "Too many authentication attempts. Try again later." } },
  });
  const sameSite = options.cookieSecure ? "none" : "lax";
  if (options.trustProxy) app.set("trust proxy", 1);

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({
    origin: options.frontendOrigin,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use(session({
    name: "lms.sid",
    secret: options.sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: options.cookieSecure,
      sameSite,
      maxAge: 1000 * 60 * 60 * 24,
      path: "/",
    },
  }));
  app.use("/api/auth", (_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(requireCsrf);

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.get("/api/auth/csrf", (request, response, next) => {
    if (!request.session.csrfToken) request.session.csrfToken = randomBytes(32).toString("hex");
    request.session.save((error) => {
      if (error) {
        next(error);
        return;
      }
      response.json({ csrfToken: request.session.csrfToken });
    });
  });

  app.post("/api/auth/register", authLimiter, asyncRoute(async (request, response) => {
    const input = validate(registrationSchema, request.body);
    const normalizedEmail = input.email.toLowerCase();
    const passwordHash = await bcrypt.hash(input.password, 12);
    let user: User;
    try {
      user = await repository.createUser(input.name, normalizedEmail, passwordHash);
    } catch (error) {
      if (databaseErrorCode(error) === "23505") {
        throw new HttpError(409, "ACCOUNT_EXISTS", "An account with these details already exists");
      }
      throw error;
    }
    response.status(201).json({ user: safeUser(user) });
  }));

  app.post("/api/auth/login", authLimiter, asyncRoute(async (request, response) => {
    const input = validate(loginSchema, request.body);
    const record = await repository.findUserByEmail(input.email.toLowerCase());
    const hash = record?.passwordHash ?? await dummyPasswordHash;
    const matches = await bcrypt.compare(input.password, hash);
    if (!record || !matches) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
    }
    await regenerateSession(request);
    request.session.userId = record.id;
    await saveSession(request);
    response.json({ user: safeUser(record) });
  }));

  app.get("/api/auth/me", requireSignedIn(repository), (request, response) => {
    response.json({ user: safeUser(requireCurrentUser(request)) });
  });

  app.post("/api/auth/logout", asyncRoute(async (request, response) => {
    if (!request.session.userId) {
      response.clearCookie("lms.sid", { httpOnly: true, secure: options.cookieSecure, sameSite, path: "/" });
      response.status(204).end();
      return;
    }
    await new Promise<void>((resolve, reject) => {
      request.session.destroy((error) => error ? reject(error) : resolve());
    });
    response.clearCookie("lms.sid", { httpOnly: true, secure: options.cookieSecure, sameSite, path: "/" });
    response.status(204).end();
  }));

  const signedIn = requireSignedIn(repository);
  const studentOnly = requireRole("student");
  const adminOnly = requireRole("admin");

  app.get("/api/courses", asyncRoute(async (request, response) => {
    const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
    const category = typeof request.query.category === "string" ? request.query.category.trim() : "";
    const userId = request.session.userId;
    const courses = await repository.listCourses(search, category, userId);
    response.json(courses.map((course) => ({
      ...course,
      lessons: course.lessons.map((lesson) => ({ ...lesson, content: "", contentAr: "" })),
    })));
  }));

  app.get("/api/courses/:courseId", asyncRoute(async (request, response) => {
    const id = courseId(request);
    const userId = request.session.userId;
    const course = await repository.getCourse(id, userId);
    if (!course) notFound("Course not found");
    const user = userId ? await repository.findUserById(userId) : null;
    if (user?.role !== "admin" && (!userId || !await repository.isEnrolled(userId, id))) {
      course.lessons = course.lessons.map((lesson) => ({ ...lesson, content: "", contentAr: "" }));
    }
    response.json(course);
  }));

  app.get("/api/courses/:courseId/lessons", signedIn, requireEnrolledCourse(repository), asyncRoute(async (request, response) => {
    const course = await repository.getCourse(courseId(request), request.session.userId);
    if (!course) notFound("Course not found");
    response.json(course.lessons);
  }));

  app.get("/api/lessons/:lessonId", signedIn, asyncRoute(async (request, response) => {
    const lesson = await repository.getLesson(routeParam(request.params.lessonId, "lessonId"), request.session.userId);
    if (!lesson) notFound("Lesson not found");
    const user = requireCurrentUser(request);
    if (user.role !== "admin" && !await repository.isEnrolled(user.id, lesson.courseId)) {
      throw new HttpError(403, "ENROLLMENT_REQUIRED", "Enroll in this course to access its lessons");
    }
    response.json(lesson);
  }));

  app.post("/api/courses/:courseId/enroll", signedIn, studentOnly, asyncRoute(async (request, response) => {
    const id = courseId(request);
    if (!await repository.getCourse(id)) notFound("Course not found");
    const created = await repository.enroll(requireCurrentUser(request).id, id);
    response.status(created ? 201 : 200).json({ courseId: id, enrolled: true });
  }));

  app.get("/api/student/enrollments", signedIn, studentOnly, asyncRoute(async (request, response) => {
    response.json(await repository.listEnrollments(requireCurrentUser(request).id));
  }));

  app.get("/api/student/progress", signedIn, studentOnly, asyncRoute(async (request, response) => {
    const requestedCourseId = typeof request.query.courseId === "string" ? request.query.courseId : undefined;
    if (requestedCourseId && !await repository.getCourse(requestedCourseId)) notFound("Course not found");
    response.json(await repository.getProgress(requireCurrentUser(request).id, requestedCourseId));
  }));

  app.post("/api/courses/:courseId/lessons/:lessonId/complete", signedIn, studentOnly, asyncRoute(async (request, response) => {
    const userId = requireCurrentUser(request).id;
    const id = courseId(request);
    if (!await repository.getCourse(id)) notFound("Course not found");
    const lesson = await repository.getLesson(routeParam(request.params.lessonId, "lessonId"));
    if (!lesson || lesson.courseId !== id) notFound("Lesson not found in course");
    if (!await repository.isEnrolled(userId, id)) {
      throw new HttpError(403, "ENROLLMENT_REQUIRED", "Enroll in this course before completing lessons");
    }
    await repository.completeLesson(userId, id, lesson.id);
    response.json({ courseId: id, lessonId: lesson.id, completed: true });
  }));

  app.get("/api/admin/stats", signedIn, adminOnly, asyncRoute(async (_request, response) => {
    response.json(await repository.getAdminStats());
  }));

  app.get("/api/admin/students", signedIn, adminOnly, asyncRoute(async (_request, response) => {
    response.json(await repository.listAdminStudents());
  }));

  app.post("/api/admin/courses", signedIn, adminOnly, asyncRoute(async (request, response) => {
    const course = validate(courseSchema, request.body);
    try {
      await repository.createCourse(course);
    } catch (error) {
      if (databaseErrorCode(error) === "23505") {
        throw new HttpError(409, "COURSE_EXISTS", "A course or lesson with that ID already exists");
      }
      throw error;
    }
    response.status(201).json(course);
  }));

  app.put("/api/admin/courses/:courseId", signedIn, adminOnly, asyncRoute(async (request, response) => {
    const course = validate(courseSchema, request.body);
    if (course.id !== courseId(request)) {
      throw new HttpError(400, "COURSE_ID_MISMATCH", "Course ID must match the URL");
    }
    try {
      if (!await repository.updateCourse(course)) notFound("Course not found");
    } catch (error) {
      if (databaseErrorCode(error) === "23505") {
        throw new HttpError(409, "LESSON_ID_EXISTS", "A lesson ID is already used by another course");
      }
      throw error;
    }
    response.json(course);
  }));

  app.delete("/api/admin/courses/:courseId", signedIn, adminOnly, asyncRoute(async (request, response) => {
    if (!await repository.deleteCourse(courseId(request))) notFound("Course not found");
    response.status(204).end();
  }));

  app.use((_request, _response, next) => {
    next(new HttpError(404, "NOT_FOUND", "Route not found"));
  });

  const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    if (error instanceof HttpError) {
      response.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      });
      return;
    }
    if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.parse.failed") {
      response.status(400).json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON" } });
      return;
    }
    if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.too.large") {
      response.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large" } });
      return;
    }
    console.error(
      "Unhandled API error",
      typeof error === "object" && error !== null && "code" in error ? error.code : "INTERNAL_ERROR",
    );
    response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
  };
  app.use(errorHandler);

  return app;
}
