import { FormEvent, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../app/auth";

const DEFAULT_REGISTER_FORM = {
  email: "",
  password: "",
  full_name: "",
  role: "student" as "teacher" | "student" | "parent",
};

export function AuthPage() {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });
  const [registerForm, setRegisterForm] = useState(DEFAULT_REGISTER_FORM);

  const title = useMemo(
    () => (mode === "login" ? "Вход в Обучайку" : "Создание аккаунта"),
    [mode],
  );
  const subtitle = useMemo(
    () =>
      mode === "login"
        ? "Продолжай обучение, следи за прогрессом и возвращайся к своим заданиям."
        : "Создай аккаунт и собери своё пространство для обучения, практики и достижений.",
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
        await login(loginForm.email, loginForm.password);
      } else {
        await register(registerForm);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Непредвиденная ошибка");
    } finally {
      setLoading(false);
    }
  }

  function switchToLogin() {
    setError(null);
    setMode("login");
  }

  function switchToRegister() {
    setError(null);
    setMode("register");
  }

  return (
    <div className="auth-wrap">
      <div className="hero-panel">
        <div className="hero-panel__orb hero-panel__orb--top" />
        <div className="hero-panel__orb hero-panel__orb--bottom" />
        <div className="hero-sticker hero-sticker--rocket">Вперёд к звёздам</div>
        <div className="hero-sticker hero-sticker--stars">Награды внутри</div>
        <div className="hero-sticker hero-sticker--code">Код как игра</div>
        <div className="hero-panel__content">
          <div className="hero-panel__intro">
            <span className="hero-panel__eyebrow">Кабинет входа</span>
            <h1>Добро пожаловать в Обучайку</h1>
            <p>Собирай решения, открывай уровни и превращай обучение в настоящее приключение.</p>
          </div>
          <div className="hero-panel__showcase">
            <div className="hero-stat hero-stat--wide">
              <strong>Учись через практику и понятный прогресс</strong>
              <span>Задания, курсы, достижения и обратная связь собраны в одном аккуратном интерфейсе.</span>
            </div>
            <div className="hero-stat">
              <strong>Блоки</strong>
              <span>быстрый старт для первых шагов</span>
            </div>
            <div className="hero-stat">
              <strong>Python</strong>
              <span>переход к реальному коду без стресса</span>
            </div>
          </div>
          <div className="hero-strip">
            <div className="hero-strip__item">
              <span className="hero-strip__dot" />
              <div>
                <strong>Мини-миссии</strong>
                <p>Каждый урок ощущается как маленький квест.</p>
              </div>
            </div>
            <div className="hero-strip__item">
              <span className="hero-strip__dot" />
              <div>
                <strong>Награды и рост</strong>
                <p>Стикеры, достижения и новые уровни по пути.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-card__main">
          <div className="auth-card__head">
            <span className="auth-card__eyebrow">{mode === "login" ? "Авторизация" : "Регистрация"}</span>
            <h2>{title}</h2>
            <p className="auth-subtitle">{subtitle}</p>
          </div>

          <label className="auth-field">
            Email
            <input
              type="email"
              value={mode === "login" ? loginForm.email : registerForm.email}
              onChange={(event) => {
                const value = event.target.value;
                if (mode === "login") {
                  setLoginForm((current) => ({ ...current, email: value }));
                } else {
                  setRegisterForm((current) => ({ ...current, email: value }));
                }
              }}
              required
            />
          </label>

          <label className="auth-field">
            Пароль
            <input
              type="password"
              value={mode === "login" ? loginForm.password : registerForm.password}
              onChange={(event) => {
                const value = event.target.value;
                if (mode === "login") {
                  setLoginForm((current) => ({ ...current, password: value }));
                } else {
                  setRegisterForm((current) => ({ ...current, password: value }));
                }
              }}
              required
            />
          </label>

          {mode === "register" && (
            <>
              <label className="auth-field">
                Полное имя
                <input
                  value={registerForm.full_name}
                  onChange={(event) =>
                    setRegisterForm((current) => ({ ...current, full_name: event.target.value }))
                  }
                  required
                />
              </label>

              <label className="auth-field">
                Роль
                <select
                  value={registerForm.role}
                  onChange={(event) =>
                    setRegisterForm((current) => ({
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

          <div className="auth-side-info">
            <div className="auth-side-info__card">
              <strong>Что ждёт внутри</strong>
              <p>Мини-уроки, уровни, достижения и понятные шаги без скучных перегрузок.</p>
            </div>
            <div className="auth-side-info__grid">
              <div className="auth-side-info__tile">
                <span>Ученик</span>
                <strong>учится и проходит задания</strong>
              </div>
              <div className="auth-side-info__tile">
                <span>Учитель</span>
                <strong>создаёт курсы и проверяет работы</strong>
              </div>
              <div className="auth-side-info__tile">
                <span>Родитель</span>
                <strong>следит за прогрессом ребёнка</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-card__bottom">
          <div className="auth-switch">
            {mode === "login" ? (
              <>
                <span>Нет аккаунта?</span>
                <button type="button" className="link-button" onClick={switchToRegister}>
                  Зарегистрироваться
                </button>
              </>
            ) : (
              <>
                <span>Уже есть аккаунт?</span>
                <button type="button" className="link-button" onClick={switchToLogin}>
                  Вернуться ко входу
                </button>
              </>
            )}
          </div>

          <div className="auth-card__footer">
            <p className="hint">Демо-аккаунты: teacher@demo.local / student@demo.local / parent@demo.local</p>
          </div>
        </div>
      </form>
    </div>
  );
}
