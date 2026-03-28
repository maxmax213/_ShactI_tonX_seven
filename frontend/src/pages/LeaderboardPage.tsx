import { useEffect, useState } from "react";

import { api } from "../app/api";
import type { LeaderboardEntry } from "../app/types";
import { SectionCard } from "../components/SectionCard";

export function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    api.leaderboard().then(setEntries).catch(console.error);
  }, []);

  return (
    <SectionCard title="Лидерборд учеников">
      {entries.map((entry) => (
        <div key={entry.user_id} className="leader-row">
          <span>
            #{entry.rank} {entry.full_name}
          </span>
          <span>
            уровень {entry.level} / {entry.xp} XP / серия {entry.streak}
          </span>
        </div>
      ))}
    </SectionCard>
  );
}
