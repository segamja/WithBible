import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell, GuestOnly, RoleGuard } from '@/layouts/AppShell'
import { useAuthStore } from '@/stores/authStore'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { MePage } from '@/pages/MePage'
import { StudentHomePage } from '@/pages/student/HomePage'
import { CheckinPage } from '@/pages/student/CheckinPage'
import { ClassPage } from '@/pages/student/ClassPage'
import { FeedPage } from '@/pages/student/FeedPage'
import { ClassesOverviewPage } from '@/pages/ClassesOverviewPage'
import { TeacherDashboardPage } from '@/pages/teacher/TeacherDashboardPage'
import { TeacherAnnouncePage } from '@/pages/teacher/TeacherAnnouncePage'
import { AdminDashboardPage, AdminProjectsPage } from '@/pages/admin/AdminPages'
import { AdminClassesPage, AdminUsersPage } from '@/pages/admin/AdminManagePages'
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage'

export default function App() {
  const init = useAuthStore((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      <Route element={<AppShell />}>
        <Route element={<RoleGuard allow={['STUDENT']} />}>
          <Route path="/" element={<StudentHomePage />} />
          <Route path="/class" element={<ClassPage />} />
          <Route path="/feed" element={<FeedPage scope="all" />} />
        </Route>

        <Route element={<RoleGuard allow={['STUDENT', 'TEACHER']} />}>
          <Route path="/checkin" element={<CheckinPage />} />
        </Route>

        <Route element={<RoleGuard allow={['TEACHER']} />}>
          <Route path="/teacher" element={<TeacherDashboardPage />} />
          <Route path="/teacher/class" element={<ClassPage />} />
          <Route path="/teacher/feed" element={<FeedPage scope="all" />} />
          <Route path="/teacher/announce" element={<TeacherAnnouncePage />} />
        </Route>

        <Route element={<RoleGuard allow={['ADMIN']} />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
          <Route path="/admin/projects" element={<AdminProjectsPage />} />
          <Route path="/admin/classes" element={<AdminClassesPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
        </Route>

        <Route
          element={<RoleGuard allow={['STUDENT', 'TEACHER', 'ADMIN']} />}
        >
          <Route path="/progress" element={<ClassesOverviewPage />} />
        </Route>

        <Route path="/me" element={<MePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
