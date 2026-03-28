import { FormEvent, useEffect, useState } from "react";

import { api } from "../app/api";
import type { ChildProgress, LeaderboardEntry } from "../app/types";
import { EmptyState } from "../components/EmptyState";
import { SectionCard } from "../components/SectionCard";

export function ParentDashboard() {
  const [children, setChildren] = useState<ChildProgress[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [linkCode, setLinkCode] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const [childrenData, board] = await Promise.all([api.childrenProgress(), api.leaderboard()]);
    setChildren(childrenData);
    setLeaderboard(board);
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
    <>
      <SectionCard title="Панель родителя">
        <form className="inline-form" onSubmit={onLinkChild}>
          <input
            value={linkCode}
            onChange={(event) => setLinkCode(event.target.value)}
            placeholder="Введите код привязки ребенка"
            required
          />
          <button type="submit">Привязать ребенка</button>
        </form>
        {message && <p className="hint">{message}</p>}
      </SectionCard>

      <div className="two-col">
        <SectionCard title="Прогресс детей">
          {children.length === 0 && <EmptyState message="Пока нет привязанных детей" />}
          {children.map((child) => (
            <article key={child.student_id} className="submission-item">
              <h3>{child.student_name}</h3>
              <p>
                Уровень {child.level}, XP {child.xp}, серия {child.streak}
              </p>
              <p>
                Решения: {child.total_submissions}, средний балл: {child.average_score}
              </p>
            </article>
          ))}
        </SectionCard>

        <SectionCard title="Лидерборд учеников">
          {leaderboard.slice(0, 15).map((entry) => (
            <div key={entry.user_id} className="leader-row">
              <span>
                #{entry.rank} {entry.full_name}
              </span>
              <span>
                ур. {entry.level} / {entry.xp} XP
              </span>
            </div>
          ))}
        </SectionCard>
      </div>
    </>
  );
}
