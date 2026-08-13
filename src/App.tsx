import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import {
  AppShell,
  GuestOnly,
  OnboardingOnly,
  RoleGuard,
} from '@/layouts/AppShell'
import { VersionUpdateBanner } from '@/components/VersionUpdateBanner'
import { useAuthStore } from '@/stores/authStore'
import { LoginPage } from '@/pages/LoginPage'
import { LogoutPage } from '@/pages/LogoutPage'
import { SignupPage } from '@/pages/SignupPage'
import { AuthCallbackPage } from '@/pages/auth/AuthCallbackPage'
import { ClassOnboardingPage } from '@/pages/onboarding/ClassOnboardingPage'
import { MePage } from '@/pages/MePage'
import { StudentHomePage } from '@/pages/student/HomePage'
import { CheckinPage } from '@/pages/student/CheckinPage'
import { ClassPage } from '@/pages/student/ClassPage'
import { FeedPage } from '@/pages/student/FeedPage'
import { ClassesOverviewPage } from '@/pages/ClassesOverviewPage'
import { TeacherDashboardPage } from '@/pages/teacher/TeacherDashboardPage'
import { TeacherAnnouncePage } from '@/pages/teacher/TeacherAnnouncePage'
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage'
import { AdminDashboardPage, AdminProjectsPage } from '@/pages/admin/AdminPages'
import { AdminClassesPage, AdminUsersPage } from '@/pages/admin/AdminManagePages'
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage'

export default function App() {
  const init = useAuthStore((s) => s.init)

  useEffect(() => {
    void init()
    // Drop cache-bust query after a successful load
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.has('_v')) {
        url.searchParams.delete('_v')
        window.history.replaceState({}, '', url.pathname + url.search + url.hash)
      }
    } catch {
      /* ignore */
    }
  }, [init])

  return (
    <>
      <VersionUpdateBanner />
      <Routes>
      <Route path="/logout" element={<LogoutPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />

      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      <Route element={<OnboardingOnly />}>
        <Route path="/onboarding/class" element={<ClassOnboardingPage />} />
      </Route>

      <Route element={<AppShell />}>
        <Route element={<RoleGuard allow={['STUDENT']} />}>
          <Route path="/" element={<StudentHomePage />} />
        </Route>

        <Route element={<RoleGuard allow={['STUDENT', 'TEACHER', 'ADMIN']} />}>
          <Route path="/checkin" element={<CheckinPage />} />
          <Route path="/feed" element={<FeedPage scope="all" />} />
          <Route path="/class" element={<ClassPage />} />
          <Route path="/progress" element={<ClassesOverviewPage />} />
        </Route>

        <Route element={<RoleGuard allow={['TEACHER']} />}>
          <Route path="/teacher" element={<TeacherDashboardPage />} />
          <Route path="/teacher/class" element={<Navigate to="/class" replace />} />
          <Route path="/teacher/feed" element={<Navigate to="/feed" replace />} />
          <Route path="/teacher/announce" element={<TeacherAnnouncePage />} />
        </Route>

        <Route element={<RoleGuard allow={['ADMIN']} />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
          <Route path="/admin/projects" element={<AdminProjectsPage />} />
          <Route path="/admin/classes" element={<AdminClassesPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
        </Route>

        <Route path="/me" element={<MePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
