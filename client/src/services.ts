import { courses as starterCourses, type AuthUser, type Course, type Lesson } from './data'

export interface CourseService {
  list(): Promise<Course[]>
  get(id: string): Promise<Course | undefined>
  save(course: Course): Promise<Course>
  remove(id: string): Promise<void>
  enroll(courseId: string): Promise<void>
  completeLesson(courseId: string, lessonId: string): Promise<void>
  enrolledIds(): Promise<string[]>
  completedIds(courseId: string): Promise<string[]>
}

interface AuthResponse {
  user: AuthUser
}

interface CsrfResponse {
  csrfToken: string
}

interface CourseListFilters {
  search?: string
  category?: string
}

export interface StudentProgress {
  courseId: string
  enrolled: boolean
  completedLessonIds: string[]
  progressPercent: number
}

export interface StudentDashboardData {
  courses: Course[]
  enrollments: string[]
  progress: StudentProgress[]
}

export interface AdminStats {
  courseCount: number
  lessonCount: number
  enrollmentCount: number
  studentCount: number
}

export interface AdminStudentCourse {
  courseId: string
  title: string
  titleAr: string
  courseEnrollmentCount: number
  lessonCount: number
  completedLessonCount: number
  progressPercent: number
}

export interface AdminStudent {
  name: string
  email: string
  enrollmentCount: number
  courses: AdminStudentCourse[]
}

export class AuthApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(
    message: string,
    status: number,
    code?: string,
  ) {
    super(message)
    this.status = status
    this.code = code
  }
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
let currentUserRequest: Promise<AuthUser | null> | null = null
const dashboardCache = new Map<string, { expiresAt: number; request: Promise<StudentDashboardData> }>()
const dashboardCacheTtlMs = 30_000

function clearDashboardCache(): void {
  dashboardCache.clear()
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new AuthApiError('Network request failed', 0, 'NETWORK_ERROR')
  }

  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => null) as {
    error?: { code?: string; message?: string }
  } | null
  if (!response.ok) {
    throw new AuthApiError(
      body?.error?.message || 'The request could not be completed',
      response.status,
      body?.error?.code,
    )
  }
  return body as T
}

async function getCsrfToken(): Promise<string> {
  const result = await request<CsrfResponse>('/api/auth/csrf')
  return result.csrfToken
}

async function postWithCsrf<T>(path: string, body?: unknown): Promise<T> {
  return requestWithCsrf<T>(path, 'POST', body)
}

async function requestWithCsrf<T>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const csrfToken = await getCsrfToken()
  return request<T>(path, {
    method,
    headers: { 'X-CSRF-Token': csrfToken },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

export const authService = {
  currentUser(): Promise<AuthUser | null> {
    if (!currentUserRequest) {
      currentUserRequest = request<AuthResponse>('/api/auth/me')
        .then((result) => result.user)
        .catch((error: unknown) => {
          if (error instanceof AuthApiError && error.status === 401) return null
          throw error
        })
        .finally(() => {
          currentUserRequest = null
        })
    }
    return currentUserRequest
  },

  async signIn(email: string, password: string): Promise<AuthUser> {
    const result = await postWithCsrf<AuthResponse>('/api/auth/login', { email, password })
    await getCsrfToken()
    clearDashboardCache()
    return result.user
  },

  async register(name: string, email: string, password: string): Promise<AuthUser> {
    const result = await postWithCsrf<AuthResponse>('/api/auth/register', { name, email, password })
    return result.user
  },

  async signOut(): Promise<void> {
    await postWithCsrf<void>('/api/auth/logout')
    clearDashboardCache()
  },
}

export const courseApi = {
  list(filters: CourseListFilters = {}): Promise<Course[]> {
    const params = new URLSearchParams()
    if (filters.search?.trim()) params.set('search', filters.search.trim())
    if (filters.category?.trim()) params.set('category', filters.category.trim())
    const query = params.size ? `?${params.toString()}` : ''
    return request<Course[]>(`/api/courses${query}`)
  },

  get(courseId: string): Promise<Course> {
    return request<Course>(`/api/courses/${encodeURIComponent(courseId)}`)
  },

  lessons(courseId: string): Promise<Lesson[]> {
    return request<Lesson[]>(`/api/courses/${encodeURIComponent(courseId)}/lessons`)
  },

  lesson(lessonId: string): Promise<Lesson & { courseId: string }> {
    return request<Lesson & { courseId: string }>(`/api/lessons/${encodeURIComponent(lessonId)}`)
  },
}

export const studentApi = {
  dashboard(userId: string): Promise<StudentDashboardData> {
    const cached = dashboardCache.get(userId)
    if (cached && cached.expiresAt > Date.now()) return cached.request

    let request: Promise<StudentDashboardData>
    request = Promise.all([courseApi.list(), studentApi.enrollments(), studentApi.progress()])
      .then(([courses, enrollments, progress]) => {
        if (dashboardCache.get(userId)?.request === request) {
          dashboardCache.set(userId, { expiresAt: Date.now() + dashboardCacheTtlMs, request })
        }
        return { courses, enrollments, progress }
      })
      .catch((error: unknown) => {
        if (dashboardCache.get(userId)?.request === request) dashboardCache.delete(userId)
        throw error
      })
    dashboardCache.set(userId, { expiresAt: Number.POSITIVE_INFINITY, request })
    return request
  },

  enroll(courseId: string): Promise<{ courseId: string; enrolled: boolean }> {
    return postWithCsrf<{ courseId: string; enrolled: boolean }>(`/api/courses/${encodeURIComponent(courseId)}/enroll`, {})
      .then((result) => {
        clearDashboardCache()
        return result
      })
  },

  enrollments(): Promise<string[]> {
    return request<string[]>('/api/student/enrollments')
  },

  progress(courseId?: string): Promise<StudentProgress[]> {
    const query = courseId ? `?courseId=${encodeURIComponent(courseId)}` : ''
    return request<StudentProgress[]>(`/api/student/progress${query}`)
  },

  completeLesson(courseId: string, lessonId: string): Promise<{ courseId: string; lessonId: string; completed: boolean }> {
    return postWithCsrf<{ courseId: string; lessonId: string; completed: boolean }>(
      `/api/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/complete`,
      {},
    ).then((result) => {
      clearDashboardCache()
      return result
    })
  },
}

export const adminApi = {
  stats(): Promise<AdminStats> {
    return request<AdminStats>('/api/admin/stats')
  },

  students(): Promise<AdminStudent[]> {
    return request<AdminStudent[]>('/api/admin/students')
  },

  courses(): Promise<Course[]> {
    return courseApi.list()
  },

  course(courseId: string): Promise<Course> {
    return courseApi.get(courseId)
  },

  saveCourse(course: Course, isNew: boolean): Promise<Course> {
    const path = isNew ? '/api/admin/courses' : `/api/admin/courses/${encodeURIComponent(course.id)}`
    return requestWithCsrf<Course>(path, isNew ? 'POST' : 'PUT', course)
  },

  removeCourse(courseId: string): Promise<void> {
    return requestWithCsrf<void>(`/api/admin/courses/${encodeURIComponent(courseId)}`, 'DELETE')
  },
}

let demoCourses = structuredClone(starterCourses)
const enrollments = new Set(['ux-foundations', 'data-literacy'])
const completedLessons = new Set(['ux-1', 'ux-2'])

const wait = () => new Promise<void>((resolve) => window.setTimeout(resolve, 280))

export const demoService: CourseService = {
  async list() {
    await wait()
    return structuredClone(demoCourses)
  },
  async get(id) {
    await wait()
    return structuredClone(demoCourses.find((course) => course.id === id))
  },
  async save(course) {
    await wait()
    const existing = demoCourses.findIndex((item) => item.id === course.id)
    if (existing === -1) demoCourses = [structuredClone(course), ...demoCourses]
    else demoCourses = demoCourses.map((item) => item.id === course.id ? structuredClone(course) : item)
    return structuredClone(course)
  },
  async remove(id) {
    await wait()
    demoCourses = demoCourses.filter((course) => course.id !== id)
    enrollments.delete(id)
  },
  async enroll(courseId) {
    await wait()
    enrollments.add(courseId)
  },
  async completeLesson(_courseId, lessonId) {
    await wait()
    completedLessons.add(lessonId)
  },
  async enrolledIds() {
    await wait()
    return [...enrollments]
  },
  async completedIds(courseId) {
    await wait()
    const course = demoCourses.find((item) => item.id === courseId)
    return course?.lessons.filter((lesson: Lesson) => completedLessons.has(lesson.id)).map((lesson) => lesson.id) ?? []
  },
}
