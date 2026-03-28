import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { AuthPage } from "../pages/AuthPage";
import { LeaderboardPage } from "../pages/LeaderboardPage";
import { ParentDashboard } from "../pages/ParentDashboard";
import { StudentDashboard } from "../pages/StudentDashboard";
import { TeacherDashboard } from "../pages/TeacherDashboard";
import { useAuth } from "./auth";

function RoleGate({ allow }: { allow: Array<"teacher" | "student" | "parent"> }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="page-loading">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!allow.includes(user.role)) {
    if (user.role === "teacher") return <Navigate to="/teacher" replace />;
    if (user.role === "parent") return <Navigate to="/parent" replace />;
    return <Navigate to="/student" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function RootRedirect() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/auth" replace />;
  if (user.role === "teacher") return <Navigate to="/teacher" replace />;
  if (user.role === "parent") return <Navigate to="/parent" replace />;
  return <Navigate to="/student" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/auth" element={<AuthPage />} />

      <Route element={<RoleGate allow={["teacher", "parent"]} />}>
        <Route path="/leaderboard" element={<LeaderboardPage />} />
      </Route>

      <Route element={<RoleGate allow={["teacher"]} />}>
        <Route path="/teacher" element={<TeacherDashboard />} />
      </Route>

      <Route element={<RoleGate allow={["student"]} />}>
        <Route path="/student" element={<StudentDashboard />} />
      </Route>

      <Route element={<RoleGate allow={["parent"]} />}>
        <Route path="/parent" element={<ParentDashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
