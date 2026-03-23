import { Route, Routes, Navigate } from 'react-router';
import { Layout1 } from '@/components/layouts/layout-1';
import { RequireAuth } from './require-auth';
import LoginPage from '@/pages/auth/login';
import SignupPage from '@/pages/auth/signup';
import DashboardPage from '@/pages/dashboard/page';
import ChatbotListPage from '@/pages/chatbots/list';
import ChatbotDetailPage from '@/pages/chatbots/detail';

export function AppRoutingSetup() {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Protected routes with Metronic layout */}
      <Route element={<RequireAuth />}>
        <Route element={<Layout1 />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/chatbots" element={<ChatbotListPage />} />
          <Route path="/chatbots/:id" element={<ChatbotDetailPage />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
