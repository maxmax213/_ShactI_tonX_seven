import { useEffect, useMemo, useState } from "react";

import { api } from "../app/api";
import { useAuth } from "../app/auth";
import type { LeaderboardEntry } from "../app/types";
import { EmptyState } from "../components/EmptyState";
import { SectionCard } from "../components/SectionCard";

type LeaderboardPeriod = "all_time" | "month" | "week" | "today";

const MEDALS = ["🥇", "🥈", "🥉"] as const;
const PERIODS: Array<{ value: LeaderboardPeriod; label: string }> = [
  { value: "all_time", label: "За всё время" },
  { value: "month", label: "Этот месяц" },
  { value: "week", label: "Эта неделя" },
  { value: "today", label: "Сегодня" },
];

function formatDays(value: number): string {
  const abs = Math.abs(value) % 100;
  const last = abs % 10;

  if (abs >= 11 && abs <= 19) return `${value} дней`;
  if (last === 1) return `${value} день`;
  if (last >= 2 && last <= 4) return `${value} дня`;
  return `${value} дней`;
}

function medalClass(rank: number): "gold" | "silver" | "bronze" {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  return "bronze";
}

export function LeaderboardPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [period, setPeriod] = useState<LeaderboardPeriod>("all_time");
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    api
      .leaderboard({ period, limit: 10, includeMe: true })
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить рейтинг"));
  }, [period]);

  const podium = useMemo(() => entries.filter((entry) => entry.rank <= 3), [entries]);
  const topTen = useMemo(() => entries.filter((entry) => entry.rank <= 10), [entries]);
  const currentUserOutsideTop = useMemo(() => {
    if (!user?.id) return null;
    return entries.find((entry) => entry.user_id === user.id && entry.rank > 10) ?? null;
  }, [entries, user?.id]);

  return (
    <div className="leaderboard-page">
      <section className="leaderboard-page-hero">
        <div className="leaderboard-page-hero__copy">
          <p className="leaderboard-page-hero__eyebrow">Общий рейтинг</p>
          <h1>Сильнейшие ученики на орбите Обучайка</h1>
          <p>
            Большой рейтинг теперь оформлен в том же мягком визуальном стиле, что и регистрация с родительским
            кабинетом.
          </p>
        </div>

        <div className="leaderboard-page-hero__stats">
          <div>
            <span>Показываем</span>
            <strong>{topTen.length > 0 ? `топ ${topTen.length}` : "пусто"}</strong>
          </div>
          <div>
            <span>Период</span>
            <strong>{PERIODS.find((item) => item.value === period)?.label ?? "За всё время"}</strong>
          </div>
        </div>
      </section>

      <SectionCard
        title="Лидерборд учеников"
        actions={
          <div className="leaderboard-filters" aria-label="Фильтр периода рейтинга">
            {PERIODS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={period === item.value ? "leaderboard-filter active" : "leaderboard-filter"}
                onClick={() => setPeriod(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      >
        <div className="leaderboard-shell">
          <div className="leaderboard-intro">
            <p className="leaderboard-kicker">Топ учеников по XP, достижениям и серии</p>
            <p className="leaderboard-note">Первые три места вынесены в акцентные карточки, а ниже идёт удобная таблица.</p>
          </div>

          {error && <p className="error">{error}</p>}
          {!error && topTen.length === 0 && <EmptyState message="Лидерборд пока пуст." />}

          {!error && topTen.length > 0 && (
            <>
              <div className="leaderboard-podium" aria-label="Первые три места">
                {podium.map((entry) => (
                  <article
                    key={entry.user_id}
                    className={`leaderboard-podium-card ${medalClass(entry.rank)} ${
                      entry.user_id === user?.id ? "current-user" : ""
                    }`}
                  >
                    <div className="leaderboard-podium-top">
                      <span className="leaderboard-medal" aria-hidden="true">
                        {MEDALS[entry.rank - 1]}
                      </span>
                      <span className="leaderboard-place">#{entry.rank}</span>
                    </div>

                    <div className="leaderboard-name-block">
                      <h3>{entry.full_name}</h3>
                      {entry.user_id === user?.id && <span className="leaderboard-you-badge">Это вы</span>}
                    </div>

                    <p className="leaderboard-podium-xp">{entry.xp} XP</p>

                    <div className="leaderboard-stats">
                      <span className="leaderboard-stat-chip">Уровень {entry.level}</span>
                      <span className="leaderboard-stat-chip">{entry.achievement_count} ачивок</span>
                      <span className="leaderboard-stat-chip">{formatDays(entry.streak)}</span>
                    </div>
                  </article>
                ))}
              </div>

              <div className="leaderboard-table" role="table" aria-label="Таблица лидеров">
                {topTen.map((entry) => (
                  <div
                    key={entry.user_id}
                    className={entry.user_id === user?.id ? "leaderboard-table-row current-user" : "leaderboard-table-row"}
                    role="row"
                  >
                    <div className="leaderboard-student" role="cell">
                      <span className="leaderboard-rank">#{entry.rank}</span>
                      <div className="leaderboard-name-block">
                        <span className="leaderboard-name">{entry.full_name}</span>
                        {entry.user_id === user?.id && <span className="leaderboard-you-badge">Это вы</span>}
                      </div>
                    </div>

                    <div className="leaderboard-metrics" role="cell">
                      <span className="leaderboard-metric">Уровень {entry.level}</span>
                      <span className="leaderboard-metric">{entry.xp} XP</span>
                      <span className="leaderboard-metric">{entry.achievement_count} ачивок</span>
                      <span className="leaderboard-metric">{formatDays(entry.streak)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {currentUserOutsideTop && (
                <div className="leaderboard-self-wrap">
                  <p className="leaderboard-self-title">Ваше место в рейтинге</p>
                  <div className="leaderboard-table-row current-user leaderboard-self-row" role="row">
                    <div className="leaderboard-student" role="cell">
                      <span className="leaderboard-rank">#{currentUserOutsideTop.rank}</span>
                      <div className="leaderboard-name-block">
                        <span className="leaderboard-name">{currentUserOutsideTop.full_name}</span>
                        <span className="leaderboard-you-badge">Это вы</span>
                      </div>
                    </div>

                    <div className="leaderboard-metrics" role="cell">
                      <span className="leaderboard-metric">Уровень {currentUserOutsideTop.level}</span>
                      <span className="leaderboard-metric">{currentUserOutsideTop.xp} XP</span>
                      <span className="leaderboard-metric">{currentUserOutsideTop.achievement_count} ачивок</span>
                      <span className="leaderboard-metric">{formatDays(currentUserOutsideTop.streak)}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
