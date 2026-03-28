import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api, getErrorMessage } from "../app/api";
import { useAuth } from "../app/auth";
import type { ChildProgress } from "../app/types";
import { EmptyState } from "../components/EmptyState";
import { SectionCard } from "../components/SectionCard";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function levelProgress(level: number, xp: number): number {
  const levelFloor = Math.max(0, (level - 1) * 100);
  return clamp(((xp - levelFloor) / 100) * 100, 0, 100);
}

function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function childAvatar(studentId: number): string | null {
  try {
    return localStorage.getItem(`edu_orbit_avatar_${studentId}`);
  } catch {
    return null;
  }
}

function errorMessage(error: unknown): string {
  const fallback = "Не удалось привязать ребенка";
  const normalized = getErrorMessage(error, "Не удалось привязать ребенка");

  if (!normalized) return fallback;
  if (normalized.includes("Ребенок с таким кодом не найден")) return "Ребенок с таким кодом не найден";
  if (normalized.includes("Student with provided code not found")) return "Ребенок с таким кодом не найден";
  if (normalized.includes("already linked")) return "Этот ребенок уже привязан";

  return normalized;
}

export function ParentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [children, setChildren] = useState<ChildProgress[]>([]);
  const [linkCode, setLinkCode] = useState("");
  const [notice, setNotice] = useState("");
  const [errorText, setErrorText] = useState("");

  async function load() {
    const childrenData = await api.childrenProgress();
    setChildren(childrenData);
  }

  useEffect(() => {
    load().catch((err) => setErrorText(`Не удалось загрузить панель родителя: ${errorMessage(err)}`));
  }, []);

  async function onLinkChild(event: FormEvent) {
    event.preventDefault();
    setNotice("");
    setErrorText("");

    try {
      await api.linkParentByCode(linkCode);
      setLinkCode("");
      setNotice("Ребенок успешно привязан");
      await load();
    } catch (error) {
      setErrorText(errorMessage(error));
    }
  }

  return (
    <div className="parent-dashboard">
      <section className="parent-hero">
        <div className="parent-hero-copy">
          <p className="parent-hero-subtitle">Кабинет родителя</p>
          <h2>{user?.full_name ?? "Родитель"}</h2>
          <p className="parent-hero-text">
            Здесь можно привязать ребенка по коду и сразу видеть его прогресс: уровень, EXP, ачивки и активные
            курсы.
          </p>
        </div>

        <form className="parent-link-form" onSubmit={onLinkChild}>
          <label>
            Код привязки ребенка
            <input
              value={linkCode}
              onChange={(event) => setLinkCode(event.target.value)}
              placeholder="Например, 482951"
              required
            />
          </label>
          <button type="submit" className="primary">
            Добавить ребенка
          </button>
          {notice && <p className="hint">{notice}</p>}
          {errorText && <p className="error">{errorText}</p>}
        </form>

        <div className="parent-hero-bubbles" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      </section>

      <SectionCard
        title={`Список детей${children.length > 0 ? ` · ${children.length}` : ""}`}
        actions={<span className="hint">Данные обновляются после привязки автоматически</span>}
      >
        {children.length === 0 && (
          <EmptyState message="Пока нет привязанных детей. Добавьте ребенка по коду привязки выше." />
        )}

        {children.length > 0 && (
          <div className="parent-children-grid">
            {children.map((child) => {
              const progress = levelProgress(child.level, child.xp);
              const avatarUrl = childAvatar(child.student_id);

              return (
                <article key={child.student_id} className="parent-child-card">
                  <div className="parent-card-orbs" aria-hidden="true">
                    <span />
                    <span />
                  </div>

                  <div className="parent-child-head">
                    <div className="parent-child-identity">
                      <div className="parent-child-avatar">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={child.student_name} className="parent-child-avatar-image" />
                        ) : (
                          <span className="parent-child-avatar-fallback">{initials(child.student_name)}</span>
                        )}
                      </div>

                      <div className="parent-child-title">
                        <h3>{child.student_name}</h3>
                        <p className="parent-child-subtitle">
                          <span className="parent-inline-icon streak" aria-hidden="true">
                            S
                          </span>
                          Серия: {child.streak} дн.
                        </p>
                      </div>
                    </div>

                    <span className="parent-level-badge">Уровень {child.level}</span>
                  </div>

                  <div className="parent-exp-block">
                    <div className="parent-exp-row">
                      <strong className="parent-exp-value">
                        <span className="parent-inline-icon exp" aria-hidden="true">
                          XP
                        </span>
                        {child.xp} EXP
                      </strong>
                      <span>Прогресс к след. уровню</span>
                    </div>
                    <div className="parent-exp-track">
                      <div className="parent-exp-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="parent-exp-note">{Math.round(progress)}% до следующего уровня</p>
                  </div>

                  <div className="parent-child-stats">
                    <div className="parent-stat-tile">
                      <span className="parent-stat-label">
                        <span className="parent-stat-icon achievements" aria-hidden="true">
                          A
                        </span>
                        Ачивки
                      </span>
                      <strong>{child.achievements_count}</strong>
                    </div>

                    <div className="parent-stat-tile">
                      <span className="parent-stat-label">
                        <span className="parent-stat-icon courses" aria-hidden="true">
                          C
                        </span>
                        Активные курсы
                      </span>
                      <strong>{child.active_courses_count}</strong>
                    </div>

                    <div className="parent-stat-tile">
                      <span className="parent-stat-label">
                        <span className="parent-stat-icon submissions" aria-hidden="true">
                          R
                        </span>
                        Решения
                      </span>
                      <strong>{child.total_submissions}</strong>
                    </div>

                    <div className="parent-stat-tile">
                      <span className="parent-stat-label">
                        <span className="parent-stat-icon score" aria-hidden="true">
                          B
                        </span>
                        Средний балл
                      </span>
                      <strong>{Number(child.average_score).toFixed(1)}</strong>
                    </div>
                  </div>

                  <div className="parent-card-actions">
                    <button
                      type="button"
                      className="parent-detail-btn"
                      onClick={() => navigate(`/parent/children/${child.student_id}`)}
                    >
                      <span className="parent-inline-icon details" aria-hidden="true">
                        GO
                      </span>
                      Подробнее
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
