import { NavLink } from "react-router-dom";

import { useAuth } from "../app/auth";

function roleLabel(role: "teacher" | "student" | "parent" | undefined): string {
  if (role === "teacher") return "Учитель";
  if (role === "parent") return "Родитель";
  return "Ученик";
}

function initials(fullName: string | undefined): string {
  if (!fullName) return "U";
  const parts = fullName
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2);
  return parts.join("").toUpperCase();
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="layout">
      <header className="topbar">
        <div className="brand">Edu Orbit</div>
        <nav className="nav">
          {user?.role === "teacher" && <NavLink to="/teacher">Учитель</NavLink>}
          {user?.role === "student" && <NavLink to="/student">Ученик</NavLink>}
          {user?.role === "parent" && <NavLink to="/parent">Родитель</NavLink>}
          {user?.role !== "student" && <NavLink to="/leaderboard">Лидерборд</NavLink>}
        </nav>
        <div className="account">
          <div className="account-badge">
            <div className="avatar">{initials(user?.full_name)}</div>
            <div className="account-meta">
              <strong>{user?.full_name}</strong>
              <span>{roleLabel(user?.role)}</span>
            </div>
          </div>
          <button onClick={logout}>Выйти</button>
        </div>
      </header>
      <main className="main-grid">{children}</main>
    </div>
  );
}
