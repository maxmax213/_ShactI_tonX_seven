import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../app/auth";

const DEFAULT_REGISTER_FORM = {
  email: "",
  password: "",
  full_name: "",
  role: "student" as "teacher" | "student" | "parent",
};

const ABOUT_APP_MARKDOWN = `## Что это такое
**Обучайка** помогает учиться спокойно и по шагам.
Здесь ребёнок решает задания, учитель ведёт курс, а родители видят прогресс без лишней путаницы.

## Что может ученик
- проходить уроки и задания в понятном порядке;
- учиться через блоки и Python, не пугаясь сложного старта;
- получать баллы, опыт, уровни и достижения;
- видеть свой прогресс и понимать, что делать дальше.

## Что может учитель
- создавать курсы, модули и уроки;
- добавлять задания и проверять ответы;
- ставить оценки и писать обратную связь;
- сопровождать обучение не только результатом, но и поддержкой.

## Что могут родители
- смотреть, как продвигается ребёнок;
- видеть уровень, активность и успехи;
- быть рядом с обучением без постоянных напоминаний и стресса.

## Почему это удобно
- всё собрано в одном месте;
- интерфейс дружелюбный и понятный;
- обучение выглядит как путь с маленькими шагами и заметным ростом;
- у каждого есть своя роль и своя полезная информация.

## Простыми словами
**Для ребёнка:** это учебное приключение.
**Для учителя:** это удобный кабинет для работы с курсами и проверкой.
**Для родителей:** это понятное окно в прогресс ребёнка.`;

type InfoModalKind = "authors" | "program" | null;

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function renderMarkdown(markdown: string) {
  const lines = markdown.split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  function flushList() {
    if (listItems.length === 0) return;

    blocks.push(
      <ul key={`list-${blocks.length}`}>
        {listItems.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>,
    );

    listItems = [];
  }

  lines.forEach((line, index) => {
    const value = line.trim();

    if (!value) {
      flushList();
      return;
    }

    if (value.startsWith("- ")) {
      listItems.push(value.slice(2).trim());
      return;
    }

    flushList();

    if (value.startsWith("# ")) {
      blocks.push(<h3 key={`h1-${index}`}>{renderInlineMarkdown(value.slice(2))}</h3>);
      return;
    }

    if (value.startsWith("## ")) {
      blocks.push(<h4 key={`h2-${index}`}>{renderInlineMarkdown(value.slice(3))}</h4>);
      return;
    }

    blocks.push(<p key={`p-${index}`}>{renderInlineMarkdown(value)}</p>);
  });

  flushList();
  return blocks;
}

export function AuthPage() {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [openModal, setOpenModal] = useState<InfoModalKind>(null);

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
  const modalTitle = openModal === "authors" ? "Об авторах" : "О программе";

  useEffect(() => {
    if (!openModal) return undefined;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenModal(null);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [openModal]);

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
            <div className="auth-info-links">
              <button type="button" className="auth-info-links__button" onClick={() => setOpenModal("authors")}>
                Об авторах
              </button>
              <button type="button" className="auth-info-links__button" onClick={() => setOpenModal("program")}>
                О программе
              </button>
            </div>
            <p className="hint">Демо-аккаунты: teacher@demo.local / student@demo.local / parent@demo.local</p>
          </div>
        </div>
      </form>

      {openModal && (
        <div className="auth-modal-backdrop" role="presentation" onClick={() => setOpenModal(null)}>
          <div
            className="auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-info-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="auth-modal__head">
              <div>
                <span className="auth-modal__eyebrow">Информация</span>
                <h3 id="auth-info-modal-title">{modalTitle}</h3>
              </div>
              <button
                type="button"
                className="auth-modal__close"
                aria-label="Закрыть окно"
                onClick={() => setOpenModal(null)}
              >
                Закрыть
              </button>
            </div>

            <div className="auth-modal__body auth-modal__body--markdown">
              {openModal === "authors" ? (
                <>
                  <p>
                    Разработкой программного продукта занималась команда студентов в рамках соревнований по спортивному программированию.
                  </p>
                  <p>
                    ОГУ. Группа 23ПИнж(б)РПиС-1. Авторы:
                    <p>Барсуков Максим Вячеславович</p>
                    <p>Мендыгалиев Данияр Серкович</p>
                    <p>Петросян Армен Арташесович</p>
                    <p>Суховеев Александр Владимирович</p>
                    <p>Такмурзин Матвей Борисович</p>
                    <p>Давиденко Владислав Евгеньевич</p>
                  </p>
                </>
              ) : (
                renderMarkdown(ABOUT_APP_MARKDOWN)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
