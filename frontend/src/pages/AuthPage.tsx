import { FormEvent, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../app/auth";

export function AuthPage() {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "student" as "teacher" | "student" | "parent",
  });

  const title = useMemo(
    () => (mode === "login" ? "Вход в Edu Orbit" : "Создание аккаунта"),
    [mode],
  );

  if (user) {
    if (user.role === "teacher") return <Navigate to="/teacher" replace />;
    if (user.role === "parent") return <Navigate to="/parent" replace />;
    return <Navigate to="/student" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        await register(form);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Непредвиденная ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="hero-panel">
        <h1>Изучай программирование через практику</h1>
        <p>
          Блоки, Python, достижения, лидерборд и обратная связь от учителя в одном приложении.
        </p>
      </div>
      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>{title}</h2>
        <div className="tab-row">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Вход
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Регистрация
          </button>
        </div>

        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            required
          />
        </label>

        <label>
          Пароль
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            required
          />
        </label>

        {mode === "register" && (
          <>
            <label>
              Полное имя
              <input
                value={form.full_name}
                onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
                required
              />
            </label>

            <label>
              Роль
              <select
                value={form.role}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    role: event.target.value as "teacher" | "student" | "parent",
                  }))
                }
              >
                <option value="student">Ученик</option>
                <option value="teacher">Учитель</option>
                <option value="parent">Родитель</option>
              </select>
            </label>
          </>
        )}

        {error && <div className="error">{error}</div>}

        <button className="primary" type="submit" disabled={loading}>
          {loading ? "Подождите..." : mode === "login" ? "Войти" : "Создать аккаунт"}
        </button>

        <p className="hint">Демо-аккаунты: teacher@demo.local / student@demo.local / parent@demo.local</p>
      </form>
    </div>
  );
}
