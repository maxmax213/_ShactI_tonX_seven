import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../app/auth";

function roleLabel(role: "teacher" | "student" | "parent" | undefined): string {
  if (role === "teacher") return "РЈС‡РёС‚РµР»СЊ";
  if (role === "parent") return "Р РѕРґРёС‚РµР»СЊ";
  return "РЈС‡РµРЅРёРє";
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const showGamification = user?.role === "student";

  const avatarStorageKey = useMemo(() => {
    if (!user?.id) return null;
    return `edu_orbit_avatar_${user.id}`;
  }, [user?.id]);

  useEffect(() => {
    if (!avatarStorageKey) {
      setAvatarUrl(null);
      return;
    }
    const saved = localStorage.getItem(avatarStorageKey);
    setAvatarUrl(saved);
  }, [avatarStorageKey]);

  const levelProgress = useMemo(() => {
    const level = user?.level ?? 1;
    const xp = user?.xp ?? 0;
    const minXp = Math.max(0, (level - 1) * 100);
    const progress = ((xp - minXp) / 100) * 100;
    return Math.max(0, Math.min(100, progress));
  }, [user?.level, user?.xp]);

  const xpToNext = useMemo(() => {
    const level = user?.level ?? 1;
    const xp = user?.xp ?? 0;
    return Math.max(0, level * 100 - xp);
  }, [user?.level, user?.xp]);

  function handleAvatarFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !avatarStorageKey) return;
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (!result) return;
      localStorage.setItem(avatarStorageKey, result);
      setAvatarUrl(result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="layout">
      <header className="topbar">
        <div className="brand">Edu Orbit</div>
        <nav className="nav">
          {user?.role === "teacher" && <NavLink to="/teacher">РЈС‡РёС‚РµР»СЊ</NavLink>}
          {user?.role === "student" && <NavLink to="/student">РЈС‡РµРЅРёРє</NavLink>}
          {user?.role === "parent" && <NavLink to="/parent">Р РѕРґРёС‚РµР»СЊ</NavLink>}
          {user?.role !== "student" && <NavLink to="/leaderboard">Р›РёРґРµСЂР±РѕСЂРґ</NavLink>}
        </nav>
        <div className="account">
          <div className="account-badge">
            <div className="avatar-wrap">
              <div className="avatar">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" className="avatar-image" />
                ) : (
                  initials(user?.full_name)
                )}
              </div>
              <button
                type="button"
                className="avatar-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Р—Р°РіСЂСѓР·РёС‚СЊ Р°РІР°С‚Р°СЂ"
              >
                +
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="avatar-input"
                onChange={handleAvatarFile}
              />
            </div>
            <div className="account-meta">
              <strong>{user?.full_name}</strong>
              <span>{roleLabel(user?.role)}</span>
              {showGamification && (
                <>
                  <div className="topbar-level-row">
                    <span className="topbar-level-pill">РЈСЂ. {user?.level ?? 1}</span>
                    <span className="topbar-exp">EXP {user?.xp ?? 0}</span>
                  </div>
                  <div className="topbar-level-track">
                    <div className="topbar-level-fill" style={{ width: `${levelProgress}%` }} />
                  </div>
                  <span className="topbar-next-level">Р”Рѕ СЃР»РµРґ. СѓСЂРѕРІРЅСЏ: {xpToNext} EXP</span>
                </>
              )}
            </div>
          </div>
          <button onClick={logout}>Р’С‹Р№С‚Рё</button>
        </div>
      </header>
      <main className="main-grid">{children}</main>
    </div>
  );
}
