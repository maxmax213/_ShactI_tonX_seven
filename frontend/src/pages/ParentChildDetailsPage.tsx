import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api, getErrorMessage } from "../app/api";
import type { ChildAchievement, ChildDetail, ChildSubmissionInfo } from "../app/types";
import { EmptyState } from "../components/EmptyState";
import { SectionCard } from "../components/SectionCard";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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

function expProgress(level: number, xp: number): number {
  const levelFloor = Math.max(0, (level - 1) * 100);
  return clamp(((xp - levelFloor) / 100) * 100, 0, 100);
}

function rarityLabel(rarity: ChildAchievement["rarity"]): string {
  if (rarity === "epic") return "Эпическая";
  if (rarity === "rare") return "Редкая";
  return "Обычная";
}

function submissionStatus(status: ChildSubmissionInfo["status"]): string {
  if (status === "checked") return "Проверено";
  if (status === "needs_rework") return "Нужна доработка";
  return "На проверке";
}

function submissionType(type: ChildSubmissionInfo["assignment_type"]): string {
  if (type === "test") return "Тест";
  if (type === "python") return "Практика";
  return "Блоки";
}

export function ParentChildDetailsPage() {
  const navigate = useNavigate();
  const { studentId } = useParams();
  const [detail, setDetail] = useState<ChildDetail | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!studentId) return;
    api
      .childDetail(Number(studentId))
      .then(setDetail)
      .catch((err) => setMessage(`Не удалось загрузить данные ребенка: ${getErrorMessage(err)}`));
  }, [studentId]);

  const avatarUrl = useMemo(() => {
    if (!detail) return null;
    return childAvatar(detail.student_id);
  }, [detail]);

  const tests = useMemo(
    () => detail?.submissions.filter((item) => item.assignment_type === "test") ?? [],
    [detail],
  );
  const tasks = useMemo(
    () => detail?.submissions.filter((item) => item.assignment_type !== "test") ?? [],
    [detail],
  );

  if (!detail && message) {
    return (
      <SectionCard title="Ребенок">
        <p className="error">{message}</p>
      </SectionCard>
    );
  }

  if (!detail) {
    return <div className="page-loading">Загрузка...</div>;
  }

  const progress = expProgress(detail.level, detail.xp);

  return (
    <div className="parent-detail-page">
      <section className="parent-detail-hero">
        <button type="button" className="parent-detail-back" onClick={() => navigate("/parent")}>
          Назад к списку детей
        </button>

        <div className="parent-detail-main">
          <div className="parent-detail-avatar">
            {avatarUrl ? (
              <img src={avatarUrl} alt={detail.student_name} className="parent-detail-avatar-image" />
            ) : (
              <span className="parent-detail-avatar-fallback">{initials(detail.student_name)}</span>
            )}
          </div>

          <div className="parent-detail-copy">
            <p className="parent-detail-subtitle">Сведения о ребенке</p>
            <h2>{detail.student_name}</h2>
            <div className="parent-detail-level-row">
              <span className="parent-detail-level-pill">Уровень {detail.level}</span>
              <span className="parent-detail-streak">Серия {detail.streak} дн.</span>
            </div>
            <div className="parent-detail-exp-row">
              <strong>{detail.xp} EXP</strong>
              <span>До следующего уровня: {Math.max(0, detail.level * 100 - detail.xp)} EXP</span>
            </div>
            <div className="parent-detail-exp-track">
              <div className="parent-detail-exp-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <div className="parent-detail-metrics">
          <article className="parent-detail-metric">
            <span>Ачивки</span>
            <strong>{detail.achievements_count}</strong>
          </article>
          <article className="parent-detail-metric">
            <span>Активные курсы</span>
            <strong>{detail.active_courses_count}</strong>
          </article>
          <article className="parent-detail-metric">
            <span>Всего работ</span>
            <strong>{detail.total_submissions}</strong>
          </article>
          <article className="parent-detail-metric">
            <span>Средний балл</span>
            <strong>{detail.average_score.toFixed(1)}</strong>
          </article>
        </div>

        <div className="parent-hero-bubbles" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      </section>

      <SectionCard title={`Достижения · ${detail.achievements.length}`}>
        {detail.achievements.length === 0 && <EmptyState message="Пока нет достижений" />}
        {detail.achievements.length > 0 && (
          <div className="parent-detail-achievements">
            {detail.achievements.map((achievement) => (
              <article key={achievement.achievement_id} className="parent-detail-achievement-card">
                <div className={`parent-detail-achievement-icon rarity-${achievement.rarity}`} aria-hidden="true">
                  {achievement.rarity === "epic" ? "Э" : achievement.rarity === "rare" ? "Р" : "О"}
                </div>
                <div>
                  <h3>{achievement.title}</h3>
                  <p>{achievement.description}</p>
                  <p className="parent-detail-achievement-meta">
                    {rarityLabel(achievement.rarity)} · +{achievement.xp_reward} EXP
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="two-col">
        <SectionCard title={`Задания · ${tasks.length}`}>
          {tasks.length === 0 && <EmptyState message="Пока нет выполненных заданий" />}
          {tasks.length > 0 && (
            <div className="parent-detail-submissions">
              {tasks.map((item) => (
                <article key={item.submission_id} className="parent-detail-submission-card">
                  <div className="parent-detail-submission-head">
                    <h3>{item.title}</h3>
                    <span className="parent-detail-submission-type">{submissionType(item.assignment_type)}</span>
                  </div>
                  <p className="parent-detail-submission-meta">Балл: {item.score ?? "—"} / {item.max_score}</p>
                  <p className="parent-detail-submission-meta">Статус: {submissionStatus(item.status)}</p>
                  <p className="parent-detail-submission-meta">Попытка: {item.attempt}</p>
                </article>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title={`Тесты · ${tests.length}`}>
          {tests.length === 0 && <EmptyState message="Пока нет выполненных тестов" />}
          {tests.length > 0 && (
            <div className="parent-detail-submissions">
              {tests.map((item) => (
                <article key={item.submission_id} className="parent-detail-submission-card">
                  <div className="parent-detail-submission-head">
                    <h3>{item.title}</h3>
                    <span className="parent-detail-submission-type">{submissionType(item.assignment_type)}</span>
                  </div>
                  <p className="parent-detail-submission-meta">Балл: {item.score ?? "—"} / {item.max_score}</p>
                  <p className="parent-detail-submission-meta">Статус: {submissionStatus(item.status)}</p>
                  <p className="parent-detail-submission-meta">Попытка: {item.attempt}</p>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
