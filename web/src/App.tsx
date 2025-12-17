import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import DashboardLayout from "./pages/DashboardLayout";
import DashboardHome from "./pages/DashboardHome";
import "./styles/app.css";
import RoleManagementPage from "./pages/RoleManagementPage";
import UserManagementPage from "./pages/UserManagementPage";// if you already have it
import MenuManagementPage from "./pages/MenuManagementPage";
// ...
import ComingSoonPage from "./pages/ComingSoonPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardHome />} />
<Route path="users" element={<UserManagementPage />} />
            <Route path="roles" element={<RoleManagementPage />} />
<Route path="/dashboard/menu" element={<MenuManagementPage />} />
          </Route>

            <Route path="*" element={<ComingSoonPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
