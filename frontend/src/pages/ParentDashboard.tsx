import { FormEvent, useEffect, useState } from "react";

import { api } from "../app/api";
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

export function ParentDashboard() {
  const { user } = useAuth();
  const [children, setChildren] = useState<ChildProgress[]>([]);
  const [linkCode, setLinkCode] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const childrenData = await api.childrenProgress();
    setChildren(childrenData);
  }

  useEffect(() => {
    load().catch((err) => setMessage(`Не удалось загрузить панель родителя: ${String(err)}`));
  }, []);

  async function onLinkChild(event: FormEvent) {
    event.preventDefault();
    await api.linkParentByCode(linkCode);
    setLinkCode("");
    setMessage("Ребенок успешно привязан");
    await load();
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
          {message && <p className="hint">{message}</p>}
        </form>
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

              return (
                <article key={child.student_id} className="parent-child-card">
                  <div className="parent-child-head">
                    <div>
                      <h3>{child.student_name}</h3>
                      <p className="parent-child-subtitle">Серия: {child.streak} дн.</p>
                    </div>
                    <span className="parent-level-badge">Уровень {child.level}</span>
                  </div>

                  <div className="parent-exp-block">
                    <div className="parent-exp-row">
                      <strong>{child.xp} EXP</strong>
                      <span>Прогресс к след. уровню</span>
                    </div>
                    <div className="parent-exp-track">
                      <div className="parent-exp-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="parent-exp-note">{Math.round(progress)}% до следующего уровня</p>
                  </div>

                  <div className="parent-child-stats">
                    <div className="parent-stat-tile">
                      <span>Ачивки</span>
                      <strong>{child.achievements_count}</strong>
                    </div>
                    <div className="parent-stat-tile">
                      <span>Активные курсы</span>
                      <strong>{child.active_courses_count}</strong>
                    </div>
                    <div className="parent-stat-tile">
                      <span>Решения</span>
                      <strong>{child.total_submissions}</strong>
                    </div>
                    <div className="parent-stat-tile">
                      <span>Средний балл</span>
                      <strong>{Number(child.average_score).toFixed(1)}</strong>
                    </div>
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
