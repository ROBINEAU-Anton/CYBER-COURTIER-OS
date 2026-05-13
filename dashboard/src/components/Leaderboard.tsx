import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';

interface LeaderboardPlayer {
  username: string;
  credits: number;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function Leaderboard() {
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch(`${API_URL}/leaderboard`, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (res.ok) {
          const data = await res.json();
          setPlayers(data);
        }
      } catch (err) {
        console.error("Leaderboard fetch error:", err);
      }
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-2 flex-1 min-h-0">
      <h2 className="text-lg tracking-widest border-b border-cyber-neon/30 pb-2 flex items-center gap-2">
        <Trophy size={18} /> TOP RUNNERS
      </h2>
      <div className="cyber-panel flex-1 p-4 font-mono text-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto flex flex-col gap-3">
          {players.map((p, index) => (
            <div key={index} className="flex justify-between items-center bg-black/40 p-2 border-l-2 border-cyber-neon/50">
              <div className="flex items-center gap-3">
                <span className={`font-bold ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-cyber-neon/70'}`}>
                  #{index + 1}
                </span>
                <span className={index === 0 ? 'text-white font-bold' : 'text-gray-300'}>
                  {p.username}
                </span>
              </div>
              <span className="text-cyber-neon font-bold">{p.credits} ¤</span>
            </div>
          ))}
          {players.length === 0 && <div className="text-cyber-neon/50">Chargement des classements...</div>}
        </div>
      </div>
    </div>
  );
}
