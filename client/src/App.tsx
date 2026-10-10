import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { BrowserRouter, Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleHelp, Compass, GraduationCap, LayoutDashboard,
  LogOut, Menu, Moon, Plus, Search, Settings2, Shield, Sun, X,
} from 'lucide-react'
import { categories, courses as starterCourses, type AuthUser, type Course, type Lesson, type Role } from './data'
import { copy, type Language, type TranslationKey } from './i18n'
import { AuthApiError, adminApi, authService, courseApi, studentApi, type AdminStats, type AdminStudent } from './services'
import brandMark from './assets/common-ground-mark.svg'
import './App.css'

type AppContextValue = {
  lang: Language
  setLang: (language: Language) => void
  theme: 'light' | 'dark'
  toggleTheme: () => void
  user: AuthUser | null
  setUser: (user: AuthUser | null) => void
  authStatus: 'loading' | 'ready'
  authError: boolean
  setAuthError: (error: boolean) => void
  t: (key: TranslationKey) => string
}

const AppContext = createContext<AppContextValue | null>(null)
const useApp = () => {
  const value = useContext(AppContext)
  if (!value) throw new Error('App context is missing.')
  return value
}

function Root() {
  const [lang, setLangState] = useState<Language>(() => localStorage.getItem('cg-language') === 'ar' ? 'ar' : 'en')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('cg-theme') === 'dark' ? 'dark' : 'light')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authStatus, setAuthStatus] = useState<'loading' | 'ready'>('loading')
  const [authError, setAuthError] = useState(false)

  useEffect(() => {
    let active = true
    void authService.currentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser)
      })
      .catch(() => {
        if (active) setAuthError(true)
      })
      .finally(() => {
        if (active) setAuthStatus('ready')
      })
    return () => {
      active = false
    }
  }, [])

  const value = useMemo<AppContextValue>(() => ({
    lang,
    setLang(language) {
      localStorage.setItem('cg-language', language)
      setLangState(language)
    },
    theme,
    toggleTheme() {
      const next = theme === 'light' ? 'dark' : 'light'
      localStorage.setItem('cg-theme', next)
      setTheme(next)
    },
    user,
    setUser,
    authStatus,
    authError,
    setAuthError,
    t: (key) => copy[lang][key],
  }), [lang, theme, user, authStatus, authError])

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.dataset.theme = theme
  }, [lang, theme])

  return (
    <AppContext.Provider value={value}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<HomeRoute />} />
              <Route element={<StudentRoute />}>
                <Route path="/dashboard" element={<StudentDashboard />} />
              </Route>
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/courses" element={<CatalogPage />} />
              <Route path="/courses/:courseId" element={<CoursePage />} />
              <Route path="/lessons/:lessonId" element={<LessonPage />} />
              <Route path="/courses/:courseId/lessons/:lessonId" element={<LessonPage />} />
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/courses" element={<AdminCourses />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AppContext.Provider>
  )
}

function ProtectedRoute() {
  const { user, authStatus, t } = useApp()
  if (authStatus === 'loading') {
    return <div className="loading-state" role="status"><span className="loading-spinner" aria-hidden="true" />{t('loading')}</div>
  }
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

function HomeRoute() {
  const { user } = useApp()
  return <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} replace />
}

function StudentRoute() {
  const { user } = useApp()
  return user?.role === 'student' ? <Outlet /> : <Navigate to="/admin" replace />
}

function AdminRoute() {
  const { user } = useApp()
  return user?.role === 'admin' ? <Outlet /> : <Navigate to="/dashboard" replace />
}

function AppShell() {
  const { lang, setLang, theme, toggleTheme, user, setUser, setAuthError, authError, t } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = user?.role === 'admin'
  const isLessonRoute = location.pathname.startsWith('/lessons/') || location.pathname.includes('/lessons/')
  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  useEffect(() => {
    if (!location.hash) return
    const targetId = decodeURIComponent(location.hash.slice(1))
    requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [location.hash, location.pathname])

  async function logOut() {
    try {
      await authService.signOut()
      setUser(null)
      setAuthError(false)
      navigate('/login', { replace: true })
    } catch {
      setAuthError(true)
    }
  }

  return (
    <div className="app-frame" dir={dir}>
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <Link to={isAdmin ? '/admin' : '/dashboard'} className="brand-lockup" onClick={() => setMenuOpen(false)}>
          <img className="brand-logo" src={brandMark} alt="" />
          <span className="brand-name">common<span>ground</span></span>
        </Link>
        <div className="sidebar-rule" />
        <span className="nav-section">{t('workspace')}</span>
        <nav className="side-nav" aria-label="Main navigation">
          {isAdmin ? (
            <>
              <NavItem to="/admin" icon={<LayoutDashboard size={18} />} label={t('overview')} onClick={() => setMenuOpen(false)} end />
              <NavItem to="/admin/courses" icon={<BookOpen size={18} />} label={t('manageCourses')} onClick={() => setMenuOpen(false)} />
            </>
          ) : (
            <>
              <NavItem to="/dashboard" icon={<LayoutDashboard size={18} />} label={t('dashboard')} onClick={() => setMenuOpen(false)} active={location.pathname === '/dashboard' && !location.hash} end />
              <NavItem to="/catalog" icon={<Compass size={18} />} label={t('coursesNav')} onClick={() => setMenuOpen(false)} active={!isLessonRoute && (location.pathname === '/catalog' || location.pathname === '/courses' || location.pathname.startsWith('/courses/'))} />
              <NavItem to="/dashboard#my-courses" icon={<BookOpen size={18} />} label={t('myCourses')} onClick={() => setMenuOpen(false)} active={(location.pathname === '/dashboard' && location.hash === '#my-courses') || isLessonRoute} />
              <NavItem to="/dashboard#learning-progress" icon={<CheckCircle2 size={18} />} label={t('learningProgress')} onClick={() => setMenuOpen(false)} active={location.pathname === '/dashboard' && location.hash === '#learning-progress'} />
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="support-note">
            <span className="support-icon"><CircleHelp size={16} /></span>
            <div><strong>{lang === 'ar' ? 'تعلّم على مهل' : 'Learning takes time'}</strong><p>{lang === 'ar' ? 'خطوة صغيرة تكفي اليوم.' : 'One small step is enough.'}</p></div>
          </div>
          <div className="user-card">
            <span className={`avatar ${isAdmin ? 'avatar-admin' : ''}`}>{user?.name.slice(0, 1)}</span>
            <span className="user-meta"><strong>{user?.name}</strong><small>{isAdmin ? t('adminPreview') : t('studentPreview')}</small></span>
            <button className="icon-button logout-button" type="button" onClick={logOut} aria-label={t('signOut')} title={t('signOut')}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      {menuOpen && <button className="sidebar-scrim" aria-label={t('cancel')} onClick={() => setMenuOpen(false)} />}
      <div className="main-column">
        <header className="topbar">
          <button className="icon-button menu-toggle" type="button" aria-label="Open navigation" onClick={() => setMenuOpen(!menuOpen)}><Menu size={19} /></button>
          <div className="breadcrumb"><span>{t('learn')}</span><ChevronRight size={14} className="crumb-separator" /><strong>{isAdmin ? t('administration') : t('workspace')}</strong></div>
          <div className="top-actions">
            <span className="prototype-pill"><span />{t('previewLabel')}</span>
            <button className="top-action" type="button" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} aria-label={t('language')}>{lang === 'en' ? 'عربي' : 'English'}</button>
            <button className="icon-button" type="button" onClick={toggleTheme} aria-label={t('theme')} title={t('theme')}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button>
          </div>
        </header>
        <main className="page-content">
          {authError && <div className="error-banner" role="alert">{t('authRequestError')}</div>}
          <Outlet />
        </main>
        <footer className="app-footer">{t('footer')} <span>·</span> {t('previewLabel')}</footer>
      </div>
    </div>
  )
}

function NavItem({ to, icon, label, onClick, end = false, active }: { to: string; icon: ReactNode; label: string; onClick: () => void; end?: boolean; active?: boolean }) {
  return <NavLink to={to} end={end} onClick={onClick} className={({ isActive }) => `side-link ${(active ?? isActive) ? 'side-link-active' : ''}`}>{icon}<span>{label}</span>{(active ?? end) && <span className="nav-active-dot" />}</NavLink>
}

function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { lang, setLang, theme, toggleTheme, user, setUser, authError: sessionError, setAuthError, t } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isRegister = mode === 'register'
  const registrationSuccess = !isRegister &&
    (location.state as { registrationSuccess?: boolean } | null)?.registrationSuccess === true

  const selectedRole = role ?? user?.role ?? 'student'

  async function enter(email: string, password: string, selectedRole: Role, registrationName = name, form?: HTMLFormElement) {
    setLoading(true)
    setError('')
    try {
      if (isRegister) {
        await authService.register(registrationName.trim(), email, password)
        form?.reset()
        setName('')
        setUser(null)
        setAuthError(false)
        navigate('/login', { replace: true, state: { registrationSuccess: true } })
        return
      }

      const nextUser = await authService.signIn(email, password)
      if (nextUser.role !== selectedRole) {
        await authService.signOut()
        setUser(null)
        setError(t('roleMismatch'))
        return
      }
      setUser(nextUser)
      setAuthError(false)
      form?.reset()
      setName('')
      navigate(nextUser.role === 'admin' ? '/admin' : '/dashboard')
    } catch (requestError) {
      setError(authErrorMessage(requestError, t))
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const enteredName = String(values.get('name') ?? '').trim()
    const enteredEmail = String(values.get('email') ?? '').trim()
    const enteredPassword = String(values.get('password') ?? '')
    if (isRegister && enteredName.length < 2) {
      setError(t('nameRequired'))
      return
    }
    if (!enteredEmail) {
      setError(t('emailRequired'))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enteredEmail)) {
      setError(t('emailInvalid'))
      return
    }
    if (!enteredPassword) {
      setError(t('passwordRequired'))
      return
    }
    if (new TextEncoder().encode(enteredPassword).length > 72) {
      setError(t('passwordTooLong'))
      return
    }
    if (isRegister && enteredPassword.length < 12) {
      setError(t('passwordTooShort'))
      return
    }
    setError('')
    setAuthError(false)
    await enter(enteredEmail, enteredPassword, selectedRole, enteredName, form)
  }

  return (
    <div className="auth-screen" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <header className="auth-topbar">
        <Link to="/login" className="brand-lockup"><img className="brand-logo" src={brandMark} alt="" /><span className="brand-name">common<span>ground</span></span></Link>
        <div className="top-actions">
          <button className="top-action" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} type="button">{lang === 'en' ? 'عربي' : 'English'}</button>
          <button className="icon-button" onClick={toggleTheme} type="button" aria-label={t('theme')}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button>
        </div>
      </header>
      <div className="auth-layout">
        <div className="auth-story">
          <span className="eyebrow"><span className="eyebrow-rule" />{t('startHere')}</span>
          <h1>{lang === 'ar' ? 'فضولك يستحق مساحة.' : 'Curiosity deserves a place.'}</h1>
          <p>{lang === 'ar' ? 'تعلّم مع مجتمع من العقول الفضولية، وبالوتيرة التي تناسبك.' : 'Learn alongside curious minds, at a pace that feels like your own.'}</p>
          <div className="story-photo story-brand-visual" role="img" aria-label={lang === 'ar' ? 'تصميم بصري للتعلّم الرقمي' : 'Digital learning brand artwork'}><div className="brand-visual-network" aria-hidden="true"><span /><span /><span /><span /><i /><i /></div><div className="photo-caption"><span className="caption-mark"><BookOpen size={17} /></span><span>{lang === 'ar' ? 'مكانٌ للمعرفة والنمو' : 'Room to learn and grow'}</span></div></div>
          <div className="story-signoff"><span className="signoff-line" /><span>{lang === 'ar' ? 'تعلّم له معنى' : 'Learning with intention'}</span></div>
        </div>
        <div className="auth-panel">
          <div className="auth-panel-inner">
            <span className="eyebrow"><span className="eyebrow-rule" />{t('accountAccess')}</span>
            <h2>{isRegister ? t('createAccount') : t('welcomeBack')}</h2>
            <p className="auth-intro">{t('authSub')}</p>
            {registrationSuccess && <div className="success-banner" role="status">{t('registrationSuccess')}</div>}
            {(error || sessionError) && <div className="error-banner" role="alert">{error || t('authRequestError')}</div>}
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {!isRegister && <fieldset className="role-selector">
                <legend>{t('accountType')}</legend>
                <div className="role-options">
                  <label className={`role-option ${role === 'student' ? 'role-option-selected' : ''}`}>
                    <input type="radio" name="accountType" value="student" checked={selectedRole === 'student'} onChange={() => setRole('student')} />
                    <GraduationCap size={17} />
                    <span>{t('studentRole')}</span>
                  </label>
                  <label className={`role-option ${role === 'admin' ? 'role-option-selected' : ''}`}>
                    <input type="radio" name="accountType" value="admin" checked={selectedRole === 'admin'} onChange={() => setRole('admin')} />
                    <Shield size={16} />
                    <span>{t('adminRole')}</span>
                  </label>
                </div>
              </fieldset>}
              {isRegister && <label className="field-label">{t('name')}<input className="field-input" name="name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required minLength={2} placeholder={lang === 'ar' ? 'اسمك الكامل' : 'Your full name'} /></label>}
              <label className="field-label">{t('email')}<input className="field-input" name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
              <label className="field-label">{t('password')}<input className="field-input" name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} required placeholder={t('password')} /><small className="field-hint">{isRegister ? t('passwordHint') : t('authPasswordNote')}</small></label>
              <button className="button button-primary button-full" type="submit" disabled={loading}>{loading ? t('loading') : isRegister ? t('registerAction') : t('signInAction')}<DirectionalArrow lang={lang} /></button>
            </form>
            <p className="auth-switch">{isRegister ? t('haveAccount') : t('noAccount')} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? t('login') : t('register')}</Link></p>
          </div>
        </div>
      </div>
    </div>
  )
}

function authErrorMessage(error: unknown, t: (key: TranslationKey) => string): string {
  if (error instanceof AuthApiError) {
    if (error.status === 401) return t('invalidCredentials')
    if (error.status === 409) return t('accountExists')
    if (error.status === 429) return t('tooManyAttempts')
    if (error.status === 400) return t('authValidationError')
    if (error.status === 0) return t('connectionError')
  }
  return t('authRequestError')
}

function DirectionalArrow({ lang }: { lang: Language }) {
  return lang === 'ar' ? <ArrowLeft size={17} /> : <ArrowRight size={17} />
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: ReactNode; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow"><span className="eyebrow-rule" />{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>
}

function StudentDashboard() {
  const { lang, user, t } = useApp()
  const [courses, setCourses] = useState<Course[]>([])
  const [enrolled, setEnrolled] = useState<string[]>([])
  const [completed, setCompleted] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    if (!user?.id) return
    studentApi.dashboard(user.id).then(({ courses: all, enrollments: ids, progress }) => {
      if (alive) {
        setCourses(all.filter((course) => ids.includes(course.id)))
        setEnrolled(ids)
        setCompleted(Object.fromEntries(progress.map((item) => [item.courseId, item.completedLessonIds])))
        setError(false)
      }
    }).catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [user?.id])

  const lessonTotal = courses.reduce((total, course) => total + (completed[course.id]?.length ?? 0), 0)
  const minutes = courses.reduce((total, course) => total + course.lessons.filter((lesson) => completed[course.id]?.includes(lesson.id)).reduce((sum, lesson) => sum + lesson.duration, 0), 0)
  const continueCourse = courses.find((course) => course.lessons.some((lesson) => !completed[course.id]?.includes(lesson.id)))
  const nextLesson = continueCourse?.lessons.find((lesson) => !completed[continueCourse.id]?.includes(lesson.id))

  return <div className="dashboard-page">
    <PageHeading eyebrow={t('thisWeek')} title={<>{t('greeting')}, {user?.name.split(' ')[0]}.</>} description={t('welcome')} />
    {error && <div className="error-banner" role="alert">{t('studentDataError')}</div>}
    <section id="learning-progress" className="stats-grid" aria-label={t('thisWeek')}>
      <StatCard icon={<BookOpen size={18} />} label={t('enrolled')} value={loading ? '—' : String(enrolled.length)} note={lang === 'ar' ? 'مساحة للتقدّم' : 'Room to make progress'} />
      <StatCard icon={<CheckCircle2 size={18} />} label={t('completed')} value={loading ? '—' : String(courses.filter((course) => course.lessons.length > 0 && completed[course.id]?.length === course.lessons.length).length)} note={lang === 'ar' ? 'إنجاز وراء إنجاز' : 'One good finish at a time'} />
      <StatCard icon={<GraduationCap size={18} />} label={t('lessonsDone')} value={loading ? '—' : String(lessonTotal)} note={lang === 'ar' ? 'كل درس يضيف جديداً' : 'Each lesson adds something'} />
      <StatCard icon={<Settings2 size={18} />} label={t('learningHours')} value={loading ? '—' : (minutes / 60).toFixed(1)} note={lang === 'ar' ? 'من وقتك الثمين' : 'Thoughtfully spent'} />
    </section>

    <section id="my-courses" className="learning-courses-section">
      {loading ? <LoadingState label={t('loading')} /> : courses.length === 0 ? (
        <section className="empty-learning"><span className="empty-mark"><BookOpen size={22} /></span><h2>{t('emptyLearning')}</h2><p>{t('emptyLearningSub')}</p><Link className="button button-primary" to="/catalog">{t('explore')}<DirectionalArrow lang={lang} /></Link></section>
      ) : (
        <>
          {continueCourse && nextLesson && <section className="continue-panel">
            <div className="continue-copy"><span className="eyebrow"><span className="eyebrow-rule" />{t('continueTitle')}</span><h2>{lang === 'ar' ? nextLesson.titleAr : nextLesson.title}</h2><p>{lang === 'ar' ? continueCourse.titleAr : continueCourse.title}</p><Link className="button button-primary" to={`/courses/${continueCourse.id}/lessons/${nextLesson.id}`}>{t('continueLearning')}<DirectionalArrow lang={lang} /></Link></div>
            <div className="continue-image" style={{ backgroundImage: `url("${continueCourse.image}")` }} role="img" aria-label={lang === 'ar' ? continueCourse.titleAr : continueCourse.title}><span className="image-index">0{continueCourse.lessons.findIndex((lesson) => lesson.id === nextLesson.id) + 1} <i>/ 0{continueCourse.lessons.length}</i></span></div>
          </section>}
          <div className="section-title-row"><div><span className="eyebrow"><span className="eyebrow-rule" />{t('allLearning')}</span><h2>{t('recentCourses')}</h2></div><Link className="text-link" to="/catalog">{t('viewAll')}<DirectionalArrow lang={lang} /></Link></div>
          <div className="course-grid dashboard-courses">{courses.map((course) => <CourseCard key={course.id} course={course} completed={completed[course.id]?.length ?? 0} />)}</div>
        </>
      )}
    </section>
    <section className="discovery-strip"><div><span className="eyebrow"><span className="eyebrow-rule" />{t('popular')}</span><h2>{t('findNext')}</h2><p>{t('findSubtitle')}</p></div><Link className="button button-outline" to="/catalog">{t('discover')}<DirectionalArrow lang={lang} /></Link></section>
  </div>
}

function StatCard({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
  return <article className="stat-card"><div className="stat-top"><span className="stat-icon">{icon}</span><span className="stat-dot" /></div><strong className="stat-value">{value}</strong><span className="stat-label">{label}</span><span className="stat-note">{note}</span></article>
}

function CatalogPage() {
  const { lang, t } = useApp()
  const [allCourses, setAllCourses] = useState<Course[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => {
    let alive = true
    const category = categories.find((item) => item.id === selected)
    const timeout = window.setTimeout(() => {
      setLoading(true)
      setError(false)
      courseApi.list({
        search,
        category: selected === 'all' ? undefined : lang === 'ar' ? category?.ar : category?.en,
      }).then((items) => {
        if (alive) setAllCourses(items)
      }).catch(() => {
        if (alive) {
          setAllCourses([])
          setError(true)
        }
      }).finally(() => alive && setLoading(false))
    }, 180)
    return () => {
      alive = false
      window.clearTimeout(timeout)
    }
  }, [lang, search, selected])

  return <div className="catalog-page">
    <PageHeading eyebrow={t('discover')} title={t('findNext')} description={t('findSubtitle')} />
    <section className="catalog-tools">
      <label className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('search')} aria-label={t('search')} /><span className="search-shortcut">⌕</span></label>
      <div className="filter-chips" role="group" aria-label={t('categories')}>{categories.map((category) => <button key={category.id} className={`filter-chip ${selected === category.id ? 'filter-chip-active' : ''}`} type="button" onClick={() => setSelected(category.id)}>{lang === 'ar' ? category.ar : category.en}</button>)}</div>
    </section>
    <div className="catalog-result-line"><span>{t('categories')}</span><strong>{allCourses.length} {t('courses')}</strong></div>
    {loading ? <LoadingState label={t('loading')} /> : error ? <div className="error-banner" role="alert">{t('catalogLoadError')}</div> : allCourses.length ? <div className="course-grid">{allCourses.map((course) => <CourseCard key={course.id} course={course} />)}</div> : <div className="empty-state"><Search size={22} /><h2>{t('emptyCourses')}</h2><p>{t('search')}</p></div>}
  </div>
}

function CourseCard({ course, completed = 0 }: { course: Course; completed?: number }) {
  const { lang, t } = useApp()
  const title = lang === 'ar' ? course.titleAr : course.title
  const category = lang === 'ar' ? course.categoryAr : course.category
  const instructor = lang === 'ar' ? course.instructorAr : course.instructor
  const level = lang === 'ar' ? t(course.level.toLowerCase() as 'beginner' | 'intermediate' | 'advanced') : course.level
  const progress = Math.round(completed / Math.max(course.lessons.length, 1) * 100)
  return <article className="course-card">
    <Link to={`/courses/${course.id}`} className="course-image-link" aria-label={title}><img className="course-image" src={course.image} alt="" loading="lazy" /><span className="course-category">{category}</span><span className="image-arrow"><ArrowUpRight size={17} /></span></Link>
    <div className="course-card-body"><div className="course-meta"><span>{level}</span><span className="meta-divider" /><span>{course.lessons.length} {t('lessons')}</span></div><Link className="course-title-link" to={`/courses/${course.id}`}><h3>{title}</h3></Link><p className="course-instructor">{t('by')} {instructor}</p>
      {completed > 0 && <div className="course-progress"><div className="progress-caption"><span>{t('yourProgress')}</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div>}
    </div>
  </article>
}

function CoursePage() {
  const { courseId } = useParams()
  const { lang, user, t } = useApp()
  const [course, setCourse] = useState<Course | undefined>()
  const [enrolled, setEnrolled] = useState(false)
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadedCourseId, setLoadedCourseId] = useState<string>()
  const [error, setError] = useState(false)
  const [enrollmentError, setEnrollmentError] = useState('')
  const [enrollmentSuccess, setEnrollmentSuccess] = useState(false)
  useEffect(() => {
    let alive = true
    const loadCourse = async () => {
      const courseRequest = courseApi.get(courseId ?? '')
      if (user?.role !== 'student') {
        const item = await courseRequest
        return { item, lessons: item.lessons, enrolled: false, completedIds: [] }
      }
      const [item, ids, progress] = await Promise.all([
        courseRequest,
        studentApi.enrollments(),
        studentApi.progress(courseId),
      ])
      const enrolled = ids.includes(item.id)
      const lessons = enrolled ? await courseApi.lessons(item.id) : item.lessons
      return {
        item,
        lessons,
        enrolled,
        completedIds: progress.find((row) => row.courseId === item.id)?.completedLessonIds ?? [],
      }
    }
    loadCourse().then(({ item, lessons, enrolled, completedIds }) => {
      if (alive) {
        setError(false)
        setCourse({ ...item, lessons })
        setEnrolled(enrolled)
        setCompletedIds(completedIds)
      }
    }).catch((requestError: unknown) => {
      if (alive) {
        setCourse(undefined)
        setError(!(requestError instanceof AuthApiError && requestError.status === 404))
      }
    }).finally(() => {
      if (alive) {
        setLoading(false)
        setLoadedCourseId(courseId)
      }
    })
    return () => { alive = false }
  }, [courseId, user?.role])
  const [joining, setJoining] = useState(false)
  if (loading || loadedCourseId !== courseId) return <LoadingState label={t('loading')} />
  if (error) return <div className="error-banner" role="alert">{t('courseLoadError')}</div>
  if (!course) return <NotFound />
  const title = lang === 'ar' ? course.titleAr : course.title
  const description = lang === 'ar' ? course.descriptionAr : course.description
  const instructor = lang === 'ar' ? course.instructorAr : course.instructor
  const category = lang === 'ar' ? course.categoryAr : course.category
  const completed = completedIds.length
  const progress = Math.round(completed / Math.max(course.lessons.length, 1) * 100)

  async function enroll() {
    setJoining(true)
    setEnrollmentError('')
    setEnrollmentSuccess(false)
    try {
      await studentApi.enroll(course!.id)
      setEnrolled(true)
      setEnrollmentSuccess(true)
    } catch (requestError) {
      setEnrollmentError(
        requestError instanceof AuthApiError && requestError.status === 403
          ? t('enrollmentRequired')
          : requestError instanceof AuthApiError && requestError.status === 0
            ? t('connectionError')
            : t('enrollmentError'),
      )
    } finally {
      setJoining(false)
    }
  }

  return <div className="course-detail-page">
    <Link to="/catalog" className="back-link"><DirectionalArrow lang={lang} />{t('backCatalog')}</Link>
    <div className="detail-hero">
      <div className="detail-hero-copy"><span className="eyebrow"><span className="eyebrow-rule" />{category}</span><h1>{title}</h1><p>{description}</p><div className="detail-byline"><span className="avatar avatar-small">{instructor.charAt(0)}</span><span>{t('by')} <strong>{instructor}</strong></span><span className="meta-divider" /><span>{course.lessons.length} {t('lessons')}</span></div>
        {enrollmentSuccess && <div className="success-banner" role="status">{t('enrollmentSuccess')}</div>}
        {enrollmentError && <div className="error-banner" role="alert">{enrollmentError}</div>}
        {enrolled ? <Link className="button button-primary" to={getNextLesson(course, completedIds)}>{t('continueLearning')}<DirectionalArrow lang={lang} /></Link> : user?.role === 'student' && <button className="button button-primary" type="button" disabled={joining} onClick={() => void enroll()}>{joining ? t('loading') : t('enroll')}<DirectionalArrow lang={lang} /></button>}
      </div>
      <div className="detail-hero-image"><img src={course.image} alt="" /><div className="detail-image-label"><BookOpen size={17} /><span>{course.level === 'Beginner' ? t('beginner') : course.level === 'Advanced' ? t('advanced') : t('intermediate')}</span></div></div>
    </div>
    <div className="detail-columns"><section className="lesson-list-panel"><div className="section-title-row"><div><span className="eyebrow"><span className="eyebrow-rule" />{t('courseContents')}</span><h2>{t('lessonContents')}</h2></div><span className="lesson-total">{course.lessons.length} {t('lessons')}</span></div>{enrolled && <div className="detail-progress"><div className="progress-caption"><span>{t('yourProgress')}</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div>}<ol className="lesson-list">{course.lessons.map((lesson, index) => <li key={lesson.id}><Link to={enrolled ? `/courses/${course.id}/lessons/${lesson.id}` : '#'} onClick={!enrolled ? (event) => event.preventDefault() : undefined} className={`lesson-list-item ${completedIds.includes(lesson.id) ? 'lesson-finished' : ''}`} aria-disabled={!enrolled}><span className="lesson-number">{completedIds.includes(lesson.id) ? <Check size={16} /> : String(index + 1).padStart(2, '0')}</span><span className="lesson-item-main"><strong>{lang === 'ar' ? lesson.titleAr : lesson.title}</strong><small>{t('lesson')} {index + 1}</small></span><span className="lesson-duration">{lesson.duration} {t('minutes')}</span><ChevronLeft size={16} className="lesson-chevron" /></Link></li>)}</ol></section><aside className="detail-aside"><span className="eyebrow"><span className="eyebrow-rule" />{t('overviewLabel')}</span><h3>{lang === 'ar' ? 'معرفة تنمو خطوةً خطوة.' : 'Room to grow, one lesson at a time.'}</h3><p>{description}</p><div className="aside-stat"><BookOpen size={17} /><span>{course.lessons.length} {t('lessons')}</span></div><div className="aside-stat"><GraduationCap size={17} /><span>{instructor}</span></div><span className="aside-note">{lang === 'ar' ? 'تعلّم في الوقت الذي يناسبك.' : 'Learn at a pace that feels right.'}</span></aside></div>
  </div>
}

function getNextLesson(course: Course, completed: string[]) {
  const next = course.lessons.find((lesson) => !completed.includes(lesson.id)) ?? course.lessons[0]
  return `/courses/${course.id}/lessons/${next.id}`
}

function LessonPage() {
  const { courseId, lessonId } = useParams()
  const { lang, user, t } = useApp()
  const [course, setCourse] = useState<Course | undefined>()
  const [lesson, setLesson] = useState<Lesson | undefined>()
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadedLessonRoute, setLoadedLessonRoute] = useState<string>()
  const [error, setError] = useState('')
  const [completionError, setCompletionError] = useState('')
  const [saving, setSaving] = useState(false)
  const lessonRoute = `${courseId ?? ''}:${lessonId ?? ''}`
  useEffect(() => {
    let alive = true
    const loadLesson = async () => {
      const activeLesson = await courseApi.lesson(lessonId ?? '')
      if (courseId && activeLesson.courseId !== courseId) return null
      const resolvedCourseId = courseId ?? activeLesson.courseId
      const [item, lessons, progress] = await Promise.all([
        courseApi.get(resolvedCourseId),
        courseApi.lessons(resolvedCourseId),
        user?.role === 'student' ? studentApi.progress(resolvedCourseId) : Promise.resolve([]),
      ])
      return {
        item: { ...item, lessons },
        activeLesson,
        completedLessons: progress.find((row) => row.courseId === resolvedCourseId)?.completedLessonIds ?? [],
      }
    }
    loadLesson().then((result) => {
      if (alive) {
        setError('')
        setCourse(result?.item)
        setLesson(result?.activeLesson)
        const apiCompleted = result?.item.lessons.filter((entry) => entry.completed).map((entry) => entry.id) ?? []
        const completionIds = [...new Set([...(result?.completedLessons ?? []), ...apiCompleted])]
        setCompletedIds(completionIds)
        setCompleted(!!result?.activeLesson.completed || completionIds.includes(result?.activeLesson.id ?? ''))
      }
    }).catch((requestError: unknown) => {
      if (alive) {
        setCourse(undefined)
        setLesson(undefined)
        setError(requestError instanceof AuthApiError && requestError.status === 404
          ? ''
          : requestError instanceof AuthApiError && requestError.status === 403
            ? t('enrollmentRequired')
            : t('courseLoadError'))
      }
    }).finally(() => {
      if (alive) {
        setLoading(false)
        setLoadedLessonRoute(lessonRoute)
      }
    })
    return () => { alive = false }
  }, [courseId, lessonId, lessonRoute, t, user?.role])
  if (loading || loadedLessonRoute !== lessonRoute) return <LoadingState label={t('loading')} />
  if (error) return <div className="error-banner" role="alert">{error}</div>
  if (!course || !lesson) return <NotFound />
  const index = course.lessons.findIndex((entry) => entry.id === lesson.id)
  const title = lang === 'ar' ? lesson.titleAr : lesson.title
  const content = lang === 'ar' ? lesson.contentAr : lesson.content
  const items = course.lessons

  async function markComplete() {
    setSaving(true)
    setCompletionError('')
    try {
      const result = await studentApi.completeLesson(course!.id, lesson!.id)
      if (result.completed) {
        setCompletedIds((ids) => ids.includes(result.lessonId) ? ids : [...ids, result.lessonId])
        setCompleted(true)
      }
    } catch (requestError) {
      setCompletionError(
        requestError instanceof AuthApiError && requestError.status === 403
          ? t('enrollmentRequired')
          : requestError instanceof AuthApiError && requestError.status === 0
            ? t('connectionError')
            : t('lessonCompleteError'),
      )
    } finally {
      setSaving(false)
    }
  }

  return <div className="lesson-page">
    <Link className="back-link" to={`/courses/${course.id}`}><DirectionalArrow lang={lang} />{t('backCourse')}</Link>
    <div className="reader-layout">
      <aside className="reader-sidebar"><span className="eyebrow"><span className="eyebrow-rule" />{t('lessonContents')}</span><Link className="reader-course-title" to={`/courses/${course.id}`}>{lang === 'ar' ? course.titleAr : course.title}</Link><ol className="reader-toc">{items.map((entry, itemIndex) => <li key={entry.id}><Link to={`/courses/${course.id}/lessons/${entry.id}`} className={`toc-link ${entry.id === lesson.id ? 'toc-link-current' : ''}`}><span className="toc-number">{entry.id === lesson.id ? <span /> : completedIds.includes(entry.id) ? <Check size={14} /> : String(itemIndex + 1).padStart(2, '0')}</span><span><strong>{lang === 'ar' ? entry.titleAr : entry.title}</strong><small>{entry.duration} {t('minutes')}</small></span></Link></li>)}</ol><Link className="reader-sidebar-back" to={`/courses/${course.id}`}>{t('backCourse')}<DirectionalArrow lang={lang} /></Link></aside>
      <article className="lesson-article"><div className="reader-meta"><span>{t('lesson')} {String(index + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}</span><span className="meta-divider" /><span>{lesson.duration} {t('minutes')}</span></div><h1>{title}</h1><div className="reader-byline"><span className="avatar avatar-small">{(lang === 'ar' ? course.instructorAr : course.instructor).charAt(0)}</span><span>{t('by')} {lang === 'ar' ? course.instructorAr : course.instructor}</span></div><div className="reader-rule" /><p className="lesson-body-copy">{content}</p><blockquote className="lesson-quote"><span>“</span><p>{lang === 'ar' ? 'التعلّم يبدأ بالانتباه إلى ما كان أمامنا طوال الوقت.' : 'Learning begins by paying attention to what was already in front of us.'}</p></blockquote><p className="lesson-body-copy">{lang === 'ar' ? 'خذ لحظة للتأمل في هذه الفكرة. كيف يمكن أن تظهر في عملك اليومي؟ لا توجد إجابة واحدة صحيحة؛ المهم أن تربط ما تعلّمته بتجربتك الخاصة.' : 'Take a moment to sit with this idea. Where might it show up in your everyday work? There is no single right answer; what matters is connecting what you have read to your own experience.'}</p>{completionError && <div className="error-banner" role="alert">{completionError}</div>}<div className="lesson-complete-row">{completed ? <span className="completion-confirmation"><CheckCircle2 size={18} />{t('completedLabel')}</span> : user?.role === 'student' && <button className="button button-primary" type="button" disabled={saving} onClick={() => void markComplete()}>{saving ? t('loading') : t('markComplete')}<Check size={17} /></button>}<span className="completion-hint">{lang === 'ar' ? 'كل خطوة تستحق الاحتفاء.' : 'Every small step counts.'}</span></div><div className="lesson-navigation">{index > 0 ? <Link to={`/courses/${course.id}/lessons/${items[index - 1].id}`} className="lesson-nav-link"><ArrowDownLeft size={17} /><span><small>{t('previous')}</small><strong>{lang === 'ar' ? items[index - 1].titleAr : items[index - 1].title}</strong></span></Link> : <span />} {index < items.length - 1 && <Link to={`/courses/${course.id}/lessons/${items[index + 1].id}`} className="lesson-nav-link nav-next"><span><small>{t('next')}</small><strong>{lang === 'ar' ? items[index + 1].titleAr : items[index + 1].title}</strong></span><ArrowUpRight size={17} /></Link>}</div></article>
    </div>
  </div>
}

function AdminDashboard() {
  const { lang, t } = useApp()
  const [allCourses, setAllCourses] = useState<Course[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [students, setStudents] = useState<AdminStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => {
    let alive = true
    void Promise.all([adminApi.courses(), adminApi.stats(), adminApi.students()])
      .then(([courses, nextStats, nextStudents]) => {
        if (alive) {
          setAllCourses(courses)
          setStats(nextStats)
          setStudents(nextStudents)
        }
      })
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])
  return <div className="admin-page">
    <PageHeading eyebrow={t('administration')} title={t('overview')} description={t('adminWelcome')} action={<Link className="button button-primary" to="/admin/courses?new=1"><Plus size={17} />{t('newCourse')}</Link>} />
    {error && <div className="error-banner" role="alert">{t('adminLoadError')}</div>}
    <section className="admin-stats">
      <StatCard icon={<BookOpen size={18} />} label={t('activeCourses')} value={loading ? '—' : String(allCourses.length)} note={lang === 'ar' ? 'في مكتبتك التعليمية' : 'In your learning library'} />
      <StatCard icon={<GraduationCap size={18} />} label={t('learners')} value={loading || !stats ? '—' : String(stats.studentCount)} note={lang === 'ar' ? 'يتعلّمون بخطواتهم' : 'Learning at their own pace'} />
      <StatCard icon={<CheckCircle2 size={18} />} label={t('totalEnrollments')} value={loading || !stats ? '—' : String(stats.enrollmentCount)} note={lang === 'ar' ? 'مسارات تعليمية نشطة' : 'Learning journeys underway'} />
    </section>
    <section className="admin-courses-panel"><div className="section-title-row"><div><span className="eyebrow"><span className="eyebrow-rule" />{t('administration')}</span><h2>{t('recentCourses')}</h2></div><Link className="text-link" to="/admin/courses">{t('manageCourses')}<DirectionalArrow lang={lang} /></Link></div>{loading ? <LoadingState label={t('loading')} /> : error ? <p role="alert">{t('adminLoadError')}</p> : allCourses.length === 0 ? <div className="empty-state"><p>{t('emptyCourses')}</p></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{t('courseTitle')}</th><th>{t('category')}</th><th>{t('lessons')}</th><th>{t('level')}</th><th /></tr></thead><tbody>{allCourses.map((course) => <tr key={course.id}><td><span className="table-course"><img src={course.image} alt="" /><strong>{lang === 'ar' ? course.titleAr : course.title}</strong></span></td><td>{lang === 'ar' ? course.categoryAr : course.category}</td><td>{course.lessons.length}</td><td><span className="level-pill">{lang === 'ar' ? t(course.level.toLowerCase() as 'beginner' | 'intermediate' | 'advanced') : course.level}</span></td><td><Link className="table-edit-link" to={`/admin/courses?edit=${course.id}`}>{t('editCourse')}<ArrowUpRight size={14} /></Link></td></tr>)}</tbody></table></div>}</section>
    <section className="admin-courses-panel"><div className="section-title-row"><div><span className="eyebrow"><span className="eyebrow-rule" />{t('administration')}</span><h2>{t('studentManagement')}</h2></div></div>
      {loading ? <LoadingState label={t('loading')} /> : error ? <p role="alert">{t('adminLoadError')}</p> : students.length === 0 ? <div className="empty-state"><p>{t('noStudents')}</p></div> : <div className="admin-table-wrap"><table className="admin-table admin-students-table"><thead><tr><th>{t('name')}</th><th>{t('email')}</th><th>{t('enrollmentCount')}</th><th>{t('studentCourses')}</th></tr></thead><tbody>{students.map((student) => <tr key={student.email}><td><strong>{student.name}</strong></td><td>{student.email}</td><td>{student.enrollmentCount}</td><td>{student.courses.length ? <ul className="student-course-list">{student.courses.map((course) => <li key={course.courseId}><strong>{lang === 'ar' ? course.titleAr : course.title}</strong><span>{course.completedLessonCount}/{course.lessonCount} {t('completedLessons')} · {course.progressPercent}% · {course.courseEnrollmentCount} {t('enrollmentCount')}</span></li>)}</ul> : <span>—</span>}</td></tr>)}</tbody></table></div>}
    </section>
  </div>
}

function AdminCourses() {
  const { lang, t } = useApp()
  const navigate = useNavigate()
  const [allCourses, setAllCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [failedEditorId, setFailedEditorId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Course | null>(() => new URLSearchParams(window.location.search).has('new') ? blankCourse() : null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const isNew = new URLSearchParams(window.location.search).has('new')
  const editId = new URLSearchParams(window.location.search).get('edit')
  const editing = isNew ? draft : draft?.id === editId ? draft : null
  const loadingEditor = Boolean(editId && !isNew && !editing && failedEditorId !== editId)

  useEffect(() => {
    let alive = true
    void adminApi.courses()
      .then((items) => alive && setAllCourses(items))
      .catch(() => {
        if (alive) {
          setLoadFailed(true)
          setError('adminLoadError')
        }
      })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!editId || isNew) return
    let alive = true
    void adminApi.course(editId)
      .then((course) => alive && setDraft(course))
      .catch(() => alive && setFailedEditorId(editId))
    return () => { alive = false }
  }, [editId, isNew])

  function updateCourse(field: keyof Course, value: string) {
    setDraft((current) => (current ?? editing) ? { ...(current ?? editing)!, [field]: value } : current)
  }

  function updateLesson(index: number, field: keyof Lesson, value: string | number) {
    setDraft((current) => {
      const course = current ?? editing
      return course ? { ...course, lessons: course.lessons.map((lesson, i) => i === index ? { ...lesson, [field]: value } : lesson) } : current
    })
  }

  function moveLesson(index: number, offset: -1 | 1) {
    setDraft((current) => {
      const course = current ?? editing
      if (!course || index + offset < 0 || index + offset >= course.lessons.length) return current
      const lessons = [...course.lessons]
      ;[lessons[index], lessons[index + offset]] = [lessons[index + offset], lessons[index]]
      return { ...course, lessons }
    })
  }

  function closeEditor() {
    setDraft(null)
    navigate('/admin/courses', { replace: true })
    setError('')
  }

  async function saveCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    if (!editing.lessons.length || editing.lessons.some((lesson) => !lesson.title.trim() || !lesson.titleAr.trim() || !lesson.content.trim() || !lesson.contentAr.trim())) {
      setError(lang === 'ar' ? 'أكمل عنوان ومحتوى كل درس باللغتين.' : 'Complete every lesson title and body in both languages.')
      return
    }
    setError('')
    try {
      await adminApi.saveCourse(editing, isNew)
      setAllCourses(await adminApi.courses())
      setMessage(t('courseSaved'))
      closeEditor()
    } catch {
      setError(t('adminLoadError'))
    }
  }

  async function deleteCourse(course: Course) {
    if (!window.confirm(t('confirmDelete'))) return
    setError('')
    try {
      await adminApi.removeCourse(course.id)
      setAllCourses(await adminApi.courses())
      if (editing?.id === course.id) closeEditor()
    } catch {
      setError(t('adminLoadError'))
    }
  }

  return <div className="admin-courses-page">
    <PageHeading eyebrow={t('administration')} title={t('manageCourses')} description={lang === 'ar' ? 'أضف دوراتك ونظّم دروسها بكل عناية.' : 'Create a thoughtful course and shape its lessons.'} action={<button className="button button-primary" type="button" onClick={() => { setDraft(blankCourse()); navigate('/admin/courses?new=1') }}><Plus size={17} />{t('newCourse')}</button>} />
    {message && <div className="success-banner" role="status"><CheckCircle2 size={17} />{message}<button type="button" className="banner-close" onClick={() => setMessage('')} aria-label={t('cancel')}><X size={16} /></button></div>}
    {error && <div className="error-banner" role="alert">{error === 'adminLoadError' ? t('adminLoadError') : error}</div>}
    {failedEditorId === editId && <div className="error-banner" role="alert">{t('adminLoadError')}</div>}
    {loadingEditor && <LoadingState label={t('loading')} />}
    {editing && <form className="course-editor" onSubmit={(event) => void saveCourse(event)}>
      <div className="editor-heading"><div><span className="eyebrow"><span className="eyebrow-rule" />{t('administration')}</span><h2>{allCourses.some((item) => item.id === editing.id) ? t('editCourse') : t('newCourse')}</h2></div><button type="button" className="icon-button" onClick={closeEditor} aria-label={t('cancel')}><X size={18} /></button></div>
      <div className="editor-grid">
        <label className="field-label">{t('titleEn')}<input className="field-input" required value={editing.title} onChange={(event) => updateCourse('title', event.target.value)} /></label>
        <label className="field-label">{t('titleAr')}<input className="field-input" dir="rtl" required value={editing.titleAr} onChange={(event) => updateCourse('titleAr', event.target.value)} /></label>
        <label className="field-label">{t('category')}<select className="field-input" value={editing.category} onChange={(event) => { const category = categories.find((item) => item.en === event.target.value); setDraft((current) => { const course = current ?? editing; return course && category ? { ...course, category: category.en, categoryAr: category.ar } : course }) }}>{categories.filter((item) => item.id !== 'all').map((item) => <option key={item.id} value={item.en}>{lang === 'ar' ? item.ar : item.en}</option>)}</select></label>
        <label className="field-label">{t('level')}<select className="field-input" value={editing.level} onChange={(event) => updateCourse('level', event.target.value)}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label>
        <label className="field-label">{t('instructorEn')}<input className="field-input" required value={editing.instructor} onChange={(event) => updateCourse('instructor', event.target.value)} /></label>
        <label className="field-label">{t('instructorAr')}<input className="field-input" dir="rtl" required value={editing.instructorAr} onChange={(event) => updateCourse('instructorAr', event.target.value)} /></label>
        <label className="field-label field-wide">{t('descriptionEn')}<textarea className="field-input textarea-input" required value={editing.description} onChange={(event) => updateCourse('description', event.target.value)} /></label>
        <label className="field-label field-wide">{t('descriptionAr')}<textarea className="field-input textarea-input" dir="rtl" required value={editing.descriptionAr} onChange={(event) => updateCourse('descriptionAr', event.target.value)} /></label>
      </div>
      <div className="editor-section-title"><div><span className="eyebrow"><span className="eyebrow-rule" />{t('lessonsEditor')}</span><p>{lang === 'ar' ? 'رتّب الدروس من البداية إلى النهاية.' : 'Shape the learning journey from first step to last.'}</p></div></div>
      {editing.lessons.map((lesson, index) => <section className="lesson-editor" key={`${editing.id}-lesson-${index}`}><div className="lesson-editor-title"><span className="lesson-number">{String(index + 1).padStart(2, '0')}</span><strong>{t('lesson')} {index + 1}</strong><div className="lesson-order-actions"><button type="button" className="icon-button" disabled={index === 0} onClick={() => moveLesson(index, -1)} aria-label={t('moveUp')} title={t('moveUp')}><ChevronUp size={15} /></button><button type="button" className="icon-button" disabled={index === editing.lessons.length - 1} onClick={() => moveLesson(index, 1)} aria-label={t('moveDown')} title={t('moveDown')}><ChevronDown size={15} /></button></div>{editing.lessons.length > 1 && <button type="button" className="text-button danger-text" onClick={() => setDraft((current) => { const course = current ?? editing; return { ...course, lessons: course.lessons.filter((_, i) => i !== index) } })}>{t('removeLesson')}</button>}</div><div className="editor-grid"><label className="field-label">{t('lessonTitleEn')}<input className="field-input" required value={lesson.title} onChange={(event) => updateLesson(index, 'title', event.target.value)} /></label><label className="field-label">{t('lessonTitleAr')}<input className="field-input" dir="rtl" required value={lesson.titleAr} onChange={(event) => updateLesson(index, 'titleAr', event.target.value)} /></label><label className="field-label field-wide">{t('contentEn')}<textarea className="field-input textarea-input" required value={lesson.content} onChange={(event) => updateLesson(index, 'content', event.target.value)} /></label><label className="field-label field-wide">{t('contentAr')}<textarea className="field-input textarea-input" dir="rtl" required value={lesson.contentAr} onChange={(event) => updateLesson(index, 'contentAr', event.target.value)} /></label></div></section>)}
      <div className="editor-actions"><button className="button button-outline" type="button" onClick={() => setDraft((current) => { const course = current ?? editing; return { ...course, lessons: [...course.lessons, blankLesson()] } })}><Plus size={16} />{t('addLesson')}</button><div><button className="button button-outline" type="button" onClick={closeEditor}>{t('cancel')}</button><button className="button button-primary" type="submit">{t('saveCourse')}<Check size={16} /></button></div></div>
    </form>}
    {loading ? <LoadingState label={t('loading')} /> : loadFailed ? <p role="alert">{t('adminLoadError')}</p> : allCourses.length === 0 ? <div className="empty-state"><p>{t('emptyCourses')}</p></div> : <div className="admin-manage-list">{allCourses.map((course) => <article className="manage-course-row" key={course.id}><img src={course.image} alt="" /><div className="manage-course-copy"><strong>{lang === 'ar' ? course.titleAr : course.title}</strong><span>{lang === 'ar' ? course.categoryAr : course.category} · {course.lessons.length} {t('lessons')}</span></div><button type="button" className="button button-outline button-small" onClick={() => navigate(`/admin/courses?edit=${course.id}`)}>{t('editCourse')}<Settings2 size={15} /></button><button type="button" className="icon-button delete-icon" onClick={() => void deleteCourse(course)} aria-label={t('delete')} title={t('delete')}><X size={17} /></button></article>)}</div>}
  </div>
}

function blankLesson(): Lesson {
  return { id: `lesson-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, title: '', titleAr: '', content: '', contentAr: '', duration: 12 }
}

function blankCourse(): Course {
  return { id: `course-${Date.now()}`, title: '', titleAr: '', category: 'Design', categoryAr: 'التصميم', instructor: '', instructorAr: '', description: '', descriptionAr: '', level: 'Beginner', image: starterCourses[0].image, lessons: [blankLesson()] }
}

function LoadingState({ label }: { label: string }) {
  return <div className="loading-state" role="status"><span className="loading-spinner" />{label}</div>
}

function NotFound() {
  const { lang, user, t } = useApp()
  return <main className="not-found" dir={lang === 'ar' ? 'rtl' : 'ltr'}><span className="not-found-code">404</span><h1>{t('notFoundTitle')}</h1><p>{t('notFoundSub')}</p><Link to={user?.role === 'admin' ? '/admin' : '/dashboard'} className="button button-primary">{t('goHome')}<DirectionalArrow lang={lang} /></Link></main>
}

export default Root
