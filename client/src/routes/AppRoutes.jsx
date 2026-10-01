import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../features/auth/AuthContext.jsx';
import { SaaSTenantProvider, TenantProvider } from '../features/tenant/TenantContext.jsx';
import MainLayout from '../layouts/MainLayout.jsx';
import TenantGate from './TenantGate.jsx';
import {
  GuestRoute,
  PlatformGuestRoute,
  PlatformProtectedRoute,
  ProtectedRoute,
} from './ProtectedRoute.jsx';

import HomePage from '../pages/HomePage.jsx';
import LibraryPage from '../pages/LibraryPage.jsx';
import QuizzesPage from '../pages/QuizzesPage.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import RegisterPage from '../pages/RegisterPage.jsx';
import ForgotPasswordPage from '../pages/ForgotPasswordPage.jsx';
import VerifyEmailPage from '../pages/VerifyEmailPage.jsx';
import SetPasswordPage from '../pages/SetPasswordPage.jsx';
import StudentDashboardPage from '../pages/StudentDashboardPage.jsx';
import AdminDashboardPage from '../pages/AdminDashboardPage.jsx';
import ProfilePage from '../pages/ProfilePage.jsx';
import UploadMaterialPage from '../pages/UploadMaterialPage.jsx';
import MyUploadsPage from '../pages/MyUploadsPage.jsx';
import MaterialDetailPage from '../pages/MaterialDetailPage.jsx';
import AdminSettingsPage from '../pages/admin/AdminSettingsPage.jsx';
import AdminUsersPage from '../pages/admin/AdminUsersPage.jsx';
import AdminInvitesPage from '../pages/admin/AdminInvitesPage.jsx';
import AdminModerationPage from '../pages/admin/AdminModerationPage.jsx';
import AdminAuditPage from '../pages/admin/AdminAuditPage.jsx';
import PlatformLoginPage from '../pages/PlatformLoginPage.jsx';
import PlatformDashboardPage from '../pages/platform/PlatformDashboardPage.jsx';

function TenantAppRoutes() {
  return (
    <Routes>
      <Route element={<TenantGate />}>
        <Route element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="quizzes" element={<QuizzesPage />} />
          <Route path="materials/:id" element={<MaterialDetailPage />} />
          <Route path="verify-email" element={<VerifyEmailPage />} />

          <Route element={<GuestRoute />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="dashboard" element={<StudentDashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="uploads" element={<MyUploadsPage />} />
            <Route path="uploads/new" element={<UploadMaterialPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['tenantAdmin']} />}>
            <Route path="admin" element={<AdminDashboardPage />} />
            <Route path="admin/pending" element={<AdminModerationPage />} />
            <Route path="admin/settings" element={<AdminSettingsPage />} />
            <Route path="admin/users" element={<AdminUsersPage />} />
            <Route path="admin/invites" element={<AdminInvitesPage />} />
            <Route path="admin/audit" element={<AdminAuditPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}

function TenantTree() {
  return (
    <SaaSTenantProvider>
      <AuthProvider>
        <TenantProvider>
          <TenantAppRoutes />
        </TenantProvider>
      </AuthProvider>
    </SaaSTenantProvider>
  );
}

function PlatformTree() {
  return (
    <SaaSTenantProvider platform>
      <AuthProvider>
        <Routes>
          <Route element={<PlatformGuestRoute />}>
            <Route path="login" element={<PlatformLoginPage />} />
          </Route>
          <Route element={<PlatformProtectedRoute />}>
            <Route index element={<PlatformDashboardPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/platform" replace />} />
        </Routes>
      </AuthProvider>
    </SaaSTenantProvider>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/set-password" element={<SetPasswordPage />} />
      <Route path="/platform/*" element={<PlatformTree />} />
      <Route path="/t/:tenantSlug/*" element={<TenantTree />} />
      <Route path="/*" element={<TenantTree />} />
    </Routes>
  );
}
