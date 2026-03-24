import { Route, Routes, Navigate } from 'react-router';
import { AppLayout } from '@/components/app-layout';
import { RequireAuth } from './require-auth';
import LoginPage from '@/pages/auth/login';
import SignupPage from '@/pages/auth/signup';
import DashboardPage from '@/pages/dashboard/page';
import ChatbotListPage from '@/pages/chatbots/list';
import ChatbotDetailPage from '@/pages/chatbots/detail';

export function AppRoutingSetup() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/chatbots" element={<ChatbotListPage />} />
          <Route path="/chatbots/:id" element={<ChatbotDetailPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
