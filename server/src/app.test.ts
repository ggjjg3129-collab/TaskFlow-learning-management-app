import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import bcrypt from "bcryptjs";
import expressSession from "express-session";
import type { AddressInfo } from "node:net";
import { createApp, type AppOptions } from "./app.js";
import { getVerifiedDatabaseUrl } from "./database.js";
import type { AdminStats, AdminStudent, LessonProgress, LmsRepository } from "./repository.js";
import type { Course, Lesson, User } from "./seed-data.js";
import { seedCourses } from "./seed-data.js";

const options = {
  sessionSecret: "test-only-session-secret-with-at-least-32-characters",
  frontendOrigin: "http://localhost:5173",
  cookieSecure: false,
};

class TestRepository implements LmsRepository {
  users = new Map<string, User & { passwordHash: string }>();
  courses: Course[] = structuredClone(seedCourses);
  enrollments = new Set<string>();
  completed = new Set<string>();

  async createUser(name: string, email: string, passwordHash: string): Promise<User> {
    if ([...this.users.values()].some((user) => user.email === email)) {
      throw Object.assign(new Error("duplicate"), { code: "23505" });
    }
    const user = { id: randomUUID(), name, email, role: "student" as const, passwordHash };
    this.users.set(user.id, user);
    return user;
  }

  async createAdmin(name: string, email: string, passwordHash: string): Promise<User> {
    const user = { id: randomUUID(), name, email, role: "admin" as const, passwordHash };
    this.users.set(user.id, user);
    return user;
  }

  async findUserByEmail(email: string) {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async findUserById(id: string) {
    const user = this.users.get(id);
    return user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null;
  }

  async listCourses(search: string, category: string, userId?: string) {
    return structuredClone(this.courses.filter((course) =>
      (!search || course.title.toLowerCase().includes(search.toLowerCase()) || course.titleAr.includes(search)) &&
      (!category || course.category.toLowerCase() === category.toLowerCase() || course.categoryAr === category),
    ).map((course) => this.withCompletion(course, userId)));
  }

  async getCourse(id: string, userId?: string) {
    const course = this.courses.find((item) => item.id === id);
    return course ? structuredClone(this.withCompletion(course, userId)) : null;
  }

  async getLesson(id: string, userId?: string): Promise<(Lesson & { courseId: string }) | null> {
    for (const course of this.courses) {
      const lesson = course.lessons.find((item) => item.id === id);
      if (lesson) return { ...structuredClone(lesson), courseId: course.id, completed: userId ? this.completed.has(`${userId}:${id}`) : false };
    }
    return null;
  }

  async enroll(userId: string, courseId: string) {
    const key = `${userId}:${courseId}`;
    if (this.enrollments.has(key)) return false;
    this.enrollments.add(key);
    return true;
  }

  async isEnrolled(userId: string, courseId: string) {
    return this.enrollments.has(`${userId}:${courseId}`);
  }

  async listEnrollments(userId: string) {
    return [...this.enrollments].filter((key) => key.startsWith(`${userId}:`)).map((key) => key.slice(userId.length + 1));
  }

  async getProgress(userId: string, courseId?: string): Promise<LessonProgress[]> {
    return this.courses.filter((course) => !courseId || course.id === courseId).map((course) => {
      const completedLessonIds = course.lessons.filter((lesson) => this.completed.has(`${userId}:${lesson.id}`)).map((lesson) => lesson.id);
      return {
        courseId: course.id,
        enrolled: this.enrollments.has(`${userId}:${course.id}`),
        completedLessonIds,
        progressPercent: course.lessons.length ? Math.round(completedLessonIds.length / course.lessons.length * 100) : 0,
      };
    });
  }

  async listAdminStudents(): Promise<AdminStudent[]> {
    return [...this.users.values()]
      .filter((user) => user.role === "student")
      .map((user) => {
        const courses = [...this.enrollments]
          .filter((key) => key.startsWith(`${user.id}:`))
          .map((key) => this.courses.find((course) => course.id === key.slice(user.id.length + 1)))
          .filter((course): course is Course => course !== undefined)
          .map((course) => {
            const completedLessonCount = course.lessons.filter((lesson) => this.completed.has(`${user.id}:${lesson.id}`)).length;
            return {
              courseId: course.id,
              title: course.title,
              titleAr: course.titleAr,
              courseEnrollmentCount: [...this.enrollments].filter((key) => key.endsWith(`:${course.id}`)).length,
              lessonCount: course.lessons.length,
              completedLessonCount,
              progressPercent: course.lessons.length ? Math.round(completedLessonCount / course.lessons.length * 100) : 0,
            };
          });
        return { name: user.name, email: user.email, enrollmentCount: courses.length, courses };
      });
  }

  async completeLesson(userId: string, _courseId: string, lessonId: string) {
    this.completed.add(`${userId}:${lessonId}`);
    return true;
  }

  async getAdminStats(): Promise<AdminStats> {
    return {
      courseCount: this.courses.length,
      lessonCount: this.courses.reduce((count, course) => count + course.lessons.length, 0),
      enrollmentCount: this.enrollments.size,
      studentCount: [...this.users.values()].filter((user) => user.role === "student").length,
    };
  }

  async createCourse(course: Course) {
    if (this.courses.some((item) => item.id === course.id)) throw Object.assign(new Error("duplicate"), { code: "23505" });
    this.courses.unshift(structuredClone(course));
  }

  async updateCourse(course: Course) {
    const index = this.courses.findIndex((item) => item.id === course.id);
    if (index < 0) return false;
    this.courses[index] = structuredClone(course);
    return true;
  }

  async deleteCourse(courseId: string) {
    const index = this.courses.findIndex((course) => course.id === courseId);
    if (index < 0) return false;
    this.courses.splice(index, 1);
    return true;
  }

  private withCompletion(course: Course, userId?: string): Course {
    return {
      ...course,
      lessons: course.lessons.map((lesson) => ({
        ...lesson,
        completed: userId ? this.completed.has(`${userId}:${lesson.id}`) : false,
      })),
    };
  }
}

async function startServer(repository = new TestRepository(), appOptions: AppOptions = options) {
  const app = createApp(repository, new expressSession.MemoryStore(), appOptions);
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return {
    repository,
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

function cookieFrom(response: Response): string {
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie, "expected a session cookie");
  return cookie;
}

async function getCsrf(url: string, cookie?: string) {
  const response = await fetch(`${url}/api/auth/csrf`, { headers: cookie ? { cookie } : {} });
  assert.equal(response.status, 200);
  const body = await response.json() as { csrfToken: string };
  return { token: body.csrfToken, cookie: cookieFrom(response) };
}

async function postJson(url: string, path: string, body: unknown, csrf: { token: string; cookie: string }) {
  return fetch(`${url}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: csrf.cookie,
      "x-csrf-token": csrf.token,
    },
    body: JSON.stringify(body),
  });
}

async function login(url: string, email: string, password: string) {
  const csrf = await getCsrf(url);
  const response = await postJson(url, "/api/auth/login", { email, password }, csrf);
  return { response, cookie: cookieFrom(response) };
}

test("forces PostgreSQL URLs to use full TLS certificate verification", () => {
  const requireMode = getVerifiedDatabaseUrl("postgresql://user:password@db.example.test/lms?sslmode=require");
  const disabledMode = getVerifiedDatabaseUrl("postgres://user:password@db.example.test/lms?sslmode=disable");
  assert.equal(new URL(requireMode).searchParams.get("sslmode"), "verify-full");
  assert.equal(new URL(disabledMode).searchParams.get("sslmode"), "verify-full");
  assert.throws(() => getVerifiedDatabaseUrl("mysql://db.example.test/lms"), /PostgreSQL protocol/);
});

test("sets security headers and permits only the configured credentialed origin", async () => {
  const server = await startServer();
  try {
    const trusted = await fetch(`${server.url}/api/auth/csrf`, {
      headers: { origin: options.frontendOrigin },
    });
    assert.equal(trusted.headers.get("access-control-allow-origin"), options.frontendOrigin);
    assert.equal(trusted.headers.get("access-control-allow-credentials"), "true");
    assert.match(trusted.headers.get("set-cookie") ?? "", /HttpOnly/i);
    assert.match(trusted.headers.get("set-cookie") ?? "", /SameSite=Lax/i);
    assert.equal(trusted.headers.get("x-content-type-options"), "nosniff");
    assert.ok(trusted.headers.get("x-frame-options"));

    const untrusted = await fetch(`${server.url}/api/health`, {
      headers: { origin: "https://untrusted.example" },
    });
    assert.equal(untrusted.headers.get("access-control-allow-origin"), options.frontendOrigin);
  } finally {
    await server.close();
  }
});

test("sets Secure and SameSite=None cookies for trusted HTTPS proxy requests", async () => {
  const server = await startServer(new TestRepository(), {
    ...options,
    cookieSecure: true,
    trustProxy: true,
  });
  try {
    const response = await fetch(`${server.url}/api/auth/csrf`, {
      headers: { "x-forwarded-proto": "https" },
    });
    assert.equal(response.status, 200);
    const cookie = response.headers.get("set-cookie") ?? "";
    assert.match(cookie, /Secure/i);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=None/i);
  } finally {
    await server.close();
  }
});

test("registers students without signing them in and stores a bcrypt hash", async () => {
  const server = await startServer();
  try {
    const csrf = await getCsrf(server.url);
    const response = await postJson(server.url, "/api/auth/register", {
      name: "Test Student",
      email: "Student@Example.com",
      password: "secure demo password 123",
    }, csrf);
    assert.equal(response.status, 201);
    const result = await response.json() as { user: User };
    assert.equal(result.user.role, "student");
    assert.equal(result.user.email, "student@example.com");
    assert.equal("passwordHash" in result.user, false);
    const stored = await server.repository.findUserByEmail("student@example.com");
    assert.ok(stored?.passwordHash.startsWith("$2"));
    assert.equal(await bcrypt.compare("secure demo password 123", stored!.passwordHash), true);

    const current = await fetch(`${server.url}/api/auth/me`, { headers: { cookie: csrf.cookie } });
    assert.equal(current.status, 401);
  } finally {
    await server.close();
  }
});

test("rejects invalid registration, public admin role assignment, and unsafe requests without CSRF", async () => {
  const server = await startServer();
  try {
    const csrf = await getCsrf(server.url);
    const shortPassword = await postJson(server.url, "/api/auth/register", {
      name: "Student",
      email: "student@example.com",
      password: "short",
    }, csrf);
    assert.equal(shortPassword.status, 400);

    const adminSelfSignup = await postJson(server.url, "/api/auth/register", {
      name: "Admin",
      email: "admin@example.com",
      password: "long-enough-password",
      role: "admin",
    }, csrf);
    assert.equal(adminSelfSignup.status, 400);

    const noCsrf = await fetch(`${server.url}/api/auth/logout`, {
      method: "POST",
      headers: { cookie: csrf.cookie },
    });
    assert.equal(noCsrf.status, 403);
  } finally {
    await server.close();
  }
});

test("returns indistinguishable login errors and protects admin routes by database role", async () => {
  const repository = new TestRepository();
  const student = await repository.createUser("Student", "student@example.com", await bcrypt.hash("secure student password", 4));
  await repository.createAdmin("Admin", "admin@example.com", await bcrypt.hash("secure admin password", 4));
  const server = await startServer(repository);
  try {
    const unknown = await login(server.url, "missing@example.com", "secure student password");
    const wrongPassword = await login(server.url, "student@example.com", "incorrect password");
    assert.equal(unknown.response.status, 401);
    assert.equal(wrongPassword.response.status, 401);
    assert.deepEqual(await unknown.response.json(), await wrongPassword.response.json());

    const studentLogin = await login(server.url, "student@example.com", "secure student password");
    assert.equal(studentLogin.response.status, 200);
    const forbidden = await fetch(`${server.url}/api/admin/stats`, { headers: { cookie: studentLogin.cookie } });
    assert.equal(forbidden.status, 403);
    assert.equal((await forbidden.json() as { error: { code: string } }).error.code, "FORBIDDEN");
    assert.equal((await fetch(`${server.url}/api/admin/students`, { headers: { cookie: studentLogin.cookie } })).status, 403);
    assert.equal((await fetch(`${server.url}/api/admin/stats`)).status, 401);
    assert.equal((await fetch(`${server.url}/api/admin/students`)).status, 401);
    assert.equal(student.role, "student");

    await repository.enroll(student.id, "ux-foundations");
    await repository.completeLesson(student.id, "ux-foundations", "ux-1");
    const adminLogin = await login(server.url, "admin@example.com", "secure admin password");
    const studentsResponse = await fetch(`${server.url}/api/admin/students`, { headers: { cookie: adminLogin.cookie } });
    assert.equal(studentsResponse.status, 200);
    const students = await studentsResponse.json() as AdminStudent[];
    assert.equal(students.length, 1);
    assert.equal(students[0]?.name, "Student");
    assert.equal(students[0]?.email, "student@example.com");
    assert.equal(students[0]?.enrollmentCount, 1);
    assert.deepEqual(students[0]?.courses[0], {
      courseId: "ux-foundations",
      title: "Foundations of User Experience",
      titleAr: "أساسيات تجربة المستخدم",
      courseEnrollmentCount: 1,
      lessonCount: 3,
      completedLessonCount: 1,
      progressPercent: 33,
    });
    assert.equal("passwordHash" in students[0]!, false);
    assert.equal("id" in students[0]!, false);
    const serializedStudents = JSON.stringify(students);
    assert.doesNotMatch(serializedStudents, /password_hash|passwordHash|session|secret|token/i);
  } finally {
    await server.close();
  }
});

test("serves catalogue data and scopes enrollment and lesson progress to the signed-in student", async () => {
  const repository = new TestRepository();
  const student = await repository.createUser("Student", "student@example.com", await bcrypt.hash("secure student password", 4));
  await repository.createUser("Other Student", "other@example.com", await bcrypt.hash("other student password", 4));
  const server = await startServer(repository);
  try {
    const catalogue = await fetch(`${server.url}/api/courses?search=Experience&category=Design`);
    assert.equal(catalogue.status, 200);
    const listedCourses = await catalogue.json() as Course[];
    assert.equal(listedCourses.length, 1);
    assert.equal(listedCourses[0]?.lessons[0]?.content, "");
    const publicDetails = await fetch(`${server.url}/api/courses/ux-foundations`);
    assert.equal((await publicDetails.json() as Course).lessons[0]?.content, "");

    assert.equal((await fetch(`${server.url}/api/student/enrollments`)).status, 401);
    assert.equal((await fetch(`${server.url}/api/student/progress`)).status, 401);
    assert.equal((await fetch(`${server.url}/api/lessons/ux-1`)).status, 401);
    const anonymousCsrf = await getCsrf(server.url);
    const anonymousEnrollment = await postJson(server.url, "/api/courses/ux-foundations/enroll", {}, anonymousCsrf);
    assert.equal(anonymousEnrollment.status, 401);

    const preLoginCsrf = await getCsrf(server.url);
    const loginResponse = await postJson(
      server.url,
      "/api/auth/login",
      { email: "student@example.com", password: "secure student password" },
      preLoginCsrf,
    );
    assert.equal(loginResponse.status, 200);
    const studentLogin = { response: loginResponse, cookie: cookieFrom(loginResponse) };
    assert.notEqual(studentLogin.cookie, preLoginCsrf.cookie, "login must rotate the session ID");
    const staleCsrf = await postJson(server.url, "/api/auth/logout", undefined, {
      cookie: studentLogin.cookie,
      token: preLoginCsrf.token,
    });
    assert.equal(staleCsrf.status, 403, "pre-login CSRF tokens must not authorize the rotated session");
    const wrongCsrf = await postJson(server.url, "/api/auth/logout", undefined, {
      cookie: studentLogin.cookie,
      token: "not-the-session-csrf-token",
    });
    assert.equal(wrongCsrf.status, 403);
    assert.equal((await fetch(`${server.url}/api/auth/me`, {
      headers: { cookie: preLoginCsrf.cookie },
    })).status, 401);
    assert.equal((await fetch(`${server.url}/api/auth/me`, {
      headers: { cookie: studentLogin.cookie },
    })).status, 200);
    const csrf = await getCsrf(server.url, studentLogin.cookie);
    assert.equal((await fetch(`${server.url}/api/courses/ux-foundations/lessons`, {
      headers: { cookie: studentLogin.cookie },
    })).status, 403);
    assert.equal((await fetch(`${server.url}/api/lessons/ux-1`, {
      headers: { cookie: studentLogin.cookie },
    })).status, 403);
    const noEnrollment = await postJson(server.url, "/api/courses/ux-foundations/lessons/ux-1/complete", {}, csrf);
    assert.equal(noEnrollment.status, 403);

    const enrollment = await postJson(server.url, "/api/courses/ux-foundations/enroll", {}, csrf);
    assert.equal(enrollment.status, 201);
    const duplicateEnrollment = await postJson(server.url, "/api/courses/ux-foundations/enroll", {}, csrf);
    assert.equal(duplicateEnrollment.status, 200);
    const enrollments = await fetch(`${server.url}/api/student/enrollments`, {
      headers: { cookie: studentLogin.cookie },
    });
    assert.deepEqual(await enrollments.json(), ["ux-foundations"]);
    const courseLessons = await fetch(`${server.url}/api/courses/ux-foundations/lessons`, {
      headers: { cookie: studentLogin.cookie },
    });
    assert.equal(courseLessons.status, 200);
    assert.equal((await courseLessons.json() as Lesson[]).length, 3);
    const lessonContent = await fetch(`${server.url}/api/lessons/ux-1`, {
      headers: { cookie: studentLogin.cookie },
    });
    assert.equal(lessonContent.status, 200);
    assert.ok((await lessonContent.json() as Lesson).content.length > 0);

    const completion = await postJson(server.url, "/api/courses/ux-foundations/lessons/ux-1/complete", {}, csrf);
    assert.equal(completion.status, 200);
    const progress = await fetch(`${server.url}/api/student/progress?courseId=ux-foundations`, {
      headers: { cookie: studentLogin.cookie },
    });
    const rows = await progress.json() as LessonProgress[];
    assert.equal(rows[0]?.enrolled, true);
    assert.deepEqual(rows[0]?.completedLessonIds, ["ux-1"]);
    assert.equal(rows[0]?.progressPercent, 33);

    const logout = await postJson(server.url, "/api/auth/logout", undefined, csrf);
    assert.equal(logout.status, 204);
    assert.equal((await fetch(`${server.url}/api/auth/me`, {
      headers: { cookie: studentLogin.cookie },
    })).status, 401);
    const nextLogin = await login(server.url, "student@example.com", "secure student password");
    const persistedProgress = await fetch(`${server.url}/api/student/progress?courseId=ux-foundations`, {
      headers: { cookie: nextLogin.cookie },
    });
    assert.deepEqual((await persistedProgress.json() as LessonProgress[])[0]?.completedLessonIds, ["ux-1"]);

    const otherLogin = await login(server.url, "other@example.com", "other student password");
    const otherEnrollments = await fetch(`${server.url}/api/student/enrollments`, {
      headers: { cookie: otherLogin.cookie },
    });
    assert.deepEqual(await otherEnrollments.json(), []);
    const tamperedEnrollments = await fetch(`${server.url}/api/student/enrollments?userId=${encodeURIComponent(student.id)}`, {
      headers: { cookie: otherLogin.cookie },
    });
    assert.deepEqual(await tamperedEnrollments.json(), []);
    const otherProgress = await fetch(`${server.url}/api/student/progress?courseId=ux-foundations`, {
      headers: { cookie: otherLogin.cookie },
    });
    assert.deepEqual((await otherProgress.json() as LessonProgress[])[0]?.completedLessonIds, []);
    const tamperedProgress = await fetch(`${server.url}/api/student/progress?courseId=ux-foundations&userId=${encodeURIComponent(student.id)}`, {
      headers: { cookie: otherLogin.cookie },
    });
    assert.deepEqual((await tamperedProgress.json() as LessonProgress[])[0]?.completedLessonIds, []);
    assert.equal((await fetch(`${server.url}/api/lessons/ux-1`, {
      headers: { cookie: otherLogin.cookie },
    })).status, 403);
    const otherCsrf = await getCsrf(server.url, otherLogin.cookie);
    const crossStudentCompletion = await postJson(
      server.url,
      "/api/courses/ux-foundations/lessons/ux-1/complete",
      {},
      otherCsrf,
    );
    assert.equal(crossStudentCompletion.status, 403);
    const unchangedOtherProgress = await fetch(`${server.url}/api/student/progress?courseId=ux-foundations`, {
      headers: { cookie: otherLogin.cookie },
    });
    assert.deepEqual((await unchangedOtherProgress.json() as LessonProgress[])[0]?.completedLessonIds, []);
  } finally {
    await server.close();
  }
});

test("allows admin course management and rejects malformed course input", async () => {
  const repository = new TestRepository();
  const student = await repository.createUser("Student", "student@example.com", await bcrypt.hash("secure student password", 4));
  await repository.createAdmin("Admin", "admin@example.com", await bcrypt.hash("secure admin password", 4));
  const server = await startServer(repository);
  try {
    const anonymousCsrf = await getCsrf(server.url);
    const studentLogin = await login(server.url, "student@example.com", "secure student password");
    const studentCsrf = await getCsrf(server.url, studentLogin.cookie);
    const adminLogin = await login(server.url, "admin@example.com", "secure admin password");
    const csrf = await getCsrf(server.url, adminLogin.cookie);
    const protectedCourse = structuredClone(seedCourses[0]!);
    const unauthorizedCreateCourse = structuredClone(protectedCourse);
    unauthorizedCreateCourse.id = "unauthorized-course";
    const adminMutationAttempts = [
      {
        method: "POST",
        path: "/api/admin/courses",
        body: unauthorizedCreateCourse,
      },
      {
        method: "PUT",
        path: `/api/admin/courses/${protectedCourse.id}`,
        body: { ...protectedCourse, title: "Unauthorized update" },
      },
      {
        method: "DELETE",
        path: `/api/admin/courses/${protectedCourse.id}`,
        body: undefined,
      },
    ] as const;
    for (const attempt of adminMutationAttempts) {
      const anonymousAttempt = await fetch(`${server.url}${attempt.path}`, {
        method: attempt.method,
        headers: {
          ...(attempt.body ? { "content-type": "application/json" } : {}),
          cookie: anonymousCsrf.cookie,
          "x-csrf-token": anonymousCsrf.token,
        },
        ...(attempt.body ? { body: JSON.stringify(attempt.body) } : {}),
      });
      assert.equal(anonymousAttempt.status, 401, `anonymous ${attempt.method} ${attempt.path}`);

      const studentAttempt = await fetch(`${server.url}${attempt.path}`, {
        method: attempt.method,
        headers: {
          ...(attempt.body ? { "content-type": "application/json" } : {}),
          cookie: studentLogin.cookie,
          "x-csrf-token": studentCsrf.token,
        },
        ...(attempt.body ? { body: JSON.stringify(attempt.body) } : {}),
      });
      assert.equal(studentAttempt.status, 403, `student ${attempt.method} ${attempt.path}`);
    }
    assert.equal(repository.courses.some((course) => course.id === "unauthorized-course"), false);
    assert.equal(repository.courses.find((course) => course.id === protectedCourse.id)?.title, protectedCourse.title);
    assert.equal(student.role, "student");

    const invalid = await postJson(server.url, "/api/admin/courses", {}, csrf);
    assert.equal(invalid.status, 400);

    const course = structuredClone(seedCourses[0]!);
    course.id = "test-api-course";
    course.lessons[0]!.id = "test-api-lesson";
    const create = await postJson(server.url, "/api/admin/courses", course, csrf);
    assert.equal(create.status, 201);

    const catalogue = await fetch(`${server.url}/api/courses`);
    const listedCourses = await catalogue.json() as Course[];
    assert.equal(listedCourses.some((item) => item.id === course.id), true);
    const publicDetail = await fetch(`${server.url}/api/courses/${course.id}`);
    const publicCourse = await publicDetail.json() as Course;
    assert.equal(publicDetail.status, 200);
    assert.equal(publicCourse.title, course.title);
    assert.equal(publicCourse.lessons[0]?.content, "");
    const adminDetail = await fetch(`${server.url}/api/courses/${course.id}`, { headers: { cookie: adminLogin.cookie } });
    assert.equal(adminDetail.status, 200);
    assert.equal((await adminDetail.json() as Course).lessons[0]?.content, course.lessons[0]?.content);

    const updatedCourse = { ...course, title: "Updated API course" };
    const mismatchedUpdate = await fetch(`${server.url}/api/admin/courses/${course.id}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: adminLogin.cookie,
        "x-csrf-token": csrf.token,
      },
      body: JSON.stringify({ ...updatedCourse, id: "different-course-id" }),
    });
    assert.equal(mismatchedUpdate.status, 400);
    const update = await fetch(`${server.url}/api/admin/courses/${course.id}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: adminLogin.cookie,
        "x-csrf-token": csrf.token,
      },
      body: JSON.stringify(updatedCourse),
    });
    assert.equal(update.status, 200);
    assert.equal((await update.json() as Course).title, updatedCourse.title);

    const deletion = await fetch(`${server.url}/api/admin/courses/${course.id}`, {
      method: "DELETE",
      headers: { cookie: adminLogin.cookie, "x-csrf-token": csrf.token },
    });
    assert.equal(deletion.status, 204);
  } finally {
    await server.close();
  }
});
