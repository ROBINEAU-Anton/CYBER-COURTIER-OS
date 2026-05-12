import { useEffect, useState } from 'react';
import { Terminal, Shield, Zap, Activity } from 'lucide-react';

interface Player {
  username: string;
  credits: number;
}

interface Server {
  id: string;
  name: string;
  security_level: number;
}

interface LogEntry {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

interface GlobalAction {
  id: string;
  username: string;
  server_name: string;
  status: string;
  created_at: string;
}

const API_URL = 'http://localhost:3000';

function App() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [globalFeed, setGlobalFeed] = useState<GlobalAction[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [isMoneyFlash, setIsMoneyFlash] = useState(false);
  const [injectingId, setInjectingId] = useState<string | null>(null);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setLogs(prev => [{ id: Math.random().toString(), time: timeStr, message, type }, ...prev].slice(0, 15));
  };

  const fetchData = async () => {
    try {
      const [playerRes, serversRes, recentRes] = await Promise.all([
        fetch(`${API_URL}/player/p1`),
        fetch(`${API_URL}/servers`),
        fetch(`${API_URL}/actions/recent`)
      ]);

      if (playerRes.ok) {
        const pData = await playerRes.json();
        setPlayer(prev => {
          if (prev && pData.credits > prev.credits) {
            setIsMoneyFlash(true);
            setTimeout(() => setIsMoneyFlash(false), 800);
          }
          return pData;
        });
      }
      
      if (serversRes.ok) {
        const sData = await serversRes.json();
        setServers(sData);
      } else {
        console.error("SERVERS API ERROR:", await serversRes.text());
      }

      if (recentRes.ok) {
        const recentData = await recentRes.json();
        setGlobalFeed(prev => {
          if (prev.length > 0 && recentData.length > 0 && prev[0].id !== recentData[0].id) {
            setIsLive(true);
            setTimeout(() => setIsLive(false), 500);
          }
          return recentData;
        });
      } else {
        console.error("RECENT ACTIONS API ERROR:", await recentRes.text());
      }
    } catch (error) {
      console.error("Erreur de connexion API:", error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1000);
    addLog("Connexion au réseau neuronal établie.", "success");
    return () => clearInterval(interval);
  }, []);

  const handleInject = async (serverId: string, packetId: string, serverName: string, cost: number) => {
    if (!player || player.credits < cost) {
      addLog(`ÉCHEC: Fonds insuffisants pour le déploiement (${cost} ¤ requis).`, "error");
      return;
    }

    setInjectingId(serverId);
    
    try {
      const res = await fetch(`${API_URL}/actions/attack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: 'p1', packet_id: packetId })
      });

      const data = await res.json();

      if (res.ok) {
        addLog(`Injection de malware sur ${serverName} réussie. [ID: ${data.action_id.split('-')[0]}]`, "success");
        fetchData();
      } else {
        addLog(`ERREUR: ${data.error}`, "error");
      }
    } catch (err) {
      addLog(`FATAL: Connexion au serveur central perdue.`, "error");
    } finally {
      setTimeout(() => setInjectingId(null), 400);
    }
  };

  const handleResetSession = async () => {
    try {
      const res = await fetch(`${API_URL}/session/reset`, { method: 'POST' });
      if (res.ok) {
        addLog("Session système redémarrée. Nouveau deck assigné.", "success");
        fetchData();
      } else {
        addLog("Erreur lors du redémarrage de la session.", "error");
      }
    } catch (err) {
      addLog("FATAL: Impossible de contacter l'API pour le reset.", "error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      <div className="scanlines"></div>
      
      {/* SYSTEM FAILURE Overlay */}
      {player && player.credits <= 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-6 p-12 border-2 border-cyber-glitch bg-cyber-dark/80 text-center animate-pulse shadow-[0_0_50px_#ff003c]">
            <h1 className="text-6xl font-bold text-cyber-glitch tracking-[0.5em] drop-shadow-[0_0_15px_#ff003c]">SYSTEM FAILURE</h1>
            <p className="text-xl text-cyber-glitch/80">Fonds insuffisants. Votre deck a été compromis et tracé par la Matrice.</p>
            <button 
              onClick={handleResetSession}
              className="mt-8 px-8 py-4 border-2 border-cyber-glitch text-cyber-glitch hover:bg-cyber-glitch hover:text-black font-bold tracking-widest text-xl transition-all duration-300 shadow-[0_0_15px_#ff003c]"
            >
              [ REBOOT SESSION ]
            </button>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <header className="border-b border-cyber-neon/30 bg-cyber-dark/80 p-4 flex justify-between items-center z-20">
        <div className="flex items-center gap-2">
          <Terminal className="text-cyber-neon" size={24} />
          <h1 className="text-xl tracking-[0.3em] font-bold">CYBER-COURTIER OS v1.0</h1>
        </div>
        <div className="flex gap-8 text-sm md:text-base border border-cyber-neon/50 px-6 py-2 bg-black/50 shadow-neon">
          <div>IDENTITÉ: <span className="font-bold text-white">{player ? player.username.toUpperCase() : 'ANTON'}</span></div>
          <div>CRÉDITS: <span className={`font-bold text-cyber-neon ${isMoneyFlash ? 'animate-money-flash' : ''}`}>{player ? player.credits : '0'}</span> ¤</div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row p-4 gap-6 overflow-hidden z-20">
        
        {/* Servers Grid */}
        <section className="flex-1 flex flex-col gap-4">
          <h2 className="text-lg tracking-widest border-b border-cyber-neon/30 pb-2 flex items-center gap-2">
            <Activity size={18} /> CIBLES MATRICIELLES DÉTECTÉES
          </h2>
          
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 overflow-y-auto pr-2 pb-10">
            {servers.length === 0 ? (
              <div className="text-cyber-neon/50 animate-pulse">Recherche de cibles...</div>
            ) : (
              servers.map(server => {
                const cost = server.security_level * 100;
                return (
                  <div key={server.id} className="cyber-panel p-5 flex flex-col gap-4 group">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-bold text-white group-hover:text-cyber-neon transition-colors">
                          {server.name}
                        </h3>
                        <div className="text-xs text-cyber-neon/50 mt-1 uppercase">ID: {server.id}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Shield size={14} className={server.security_level > 5 ? 'text-cyber-glitch' : 'text-cyber-neon'} />
                          SEC-LEVEL: <span className="font-bold text-white">{server.security_level}</span>
                        </div>
                      </div>
                    </div>

                    {/* Static Graph */}
                    <div className="h-10 border-t border-b border-cyber-neon/20 flex items-end gap-1 pt-1 overflow-hidden opacity-50">
                      {Array.from({ length: 20 }).map((_, i) => (
                        <div 
                          key={i} 
                          className="w-full bg-cyber-neon/30 hover:bg-cyber-neon transition-colors"
                          style={{ height: `${Math.random() * 100}%` }}
                        ></div>
                      ))}
                    </div>

                    <div className="mt-auto pt-2">
                      <button
                        onClick={() => handleInject(server.id, `pkt-1`, server.name, cost)}
                        disabled={injectingId === server.id}
                        className={`w-full cyber-button flex justify-center items-center gap-2 group ${injectingId === server.id ? 'animate-glitch bg-cyber-neon text-black' : ''}`}
                      >
                        <Zap size={16} />
                        {injectingId === server.id ? 'INJECTION EN COURS...' : `[ INJECTER VIRUS (${cost} ¤) ]`}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Side Panel - Logs */}
        <aside className="w-full md:w-80 lg:w-96 flex flex-col gap-4 overflow-hidden">
          
          {/* Console d'Activité */}
          <div className="flex flex-col gap-2 flex-1 min-h-0">
            <h2 className="text-lg tracking-widest border-b border-cyber-neon/30 pb-2">
              CONSOLE D'ACTIVITÉ
            </h2>
            <div className="cyber-panel flex-1 p-4 font-mono text-xs overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto flex flex-col gap-2">
                {logs.map(log => (
                  <div key={log.id} className="flex gap-2">
                    <span className="text-cyber-neon/50 opacity-70">[{log.time}]</span>
                    <span className={`
                      ${log.type === 'error' ? 'text-cyber-glitch font-bold' : ''}
                      ${log.type === 'success' ? 'text-cyber-neon' : ''}
                      ${log.type === 'info' ? 'text-white' : ''}
                    `}>
                      {log.message}
                    </span>
                  </div>
                ))}
                {logs.length === 0 && <div className="text-cyber-neon/30">En attente d'événements...</div>}
              </div>
            </div>
          </div>

          {/* Flux Global */}
          <div className="flex flex-col gap-2 flex-1 min-h-0">
            <h2 className="text-lg tracking-widest border-b border-cyber-neon/30 pb-2 flex justify-between items-center">
              <span>FLUX GLOBAL</span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold transition-colors duration-300 ${isLive ? 'text-cyber-neon' : 'text-cyber-neon/50'}`}>LIVE</span>
                <div className={`w-2 h-2 rounded-full transition-all duration-300 ${isLive ? 'bg-cyber-neon shadow-[0_0_8px_#00ffcc] scale-125' : 'bg-cyber-neon/30'}`}></div>
              </div>
            </h2>
            <div className="cyber-panel flex-1 p-4 font-mono text-xs overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto flex flex-col gap-2">
                {globalFeed.map(action => (
                  <div key={action.id} className="flex gap-2">
                    <span className="text-cyber-neon/50 opacity-70 whitespace-nowrap">[{new Date(action.created_at).toLocaleTimeString()}]</span>
                    <span className="text-white">
                      <span className="text-cyber-neon font-bold">{action.username}</span> a attaqué <span className="text-gray-300">{action.server_name}</span> 
                      {' '}
                      <span className={action.status === 'SUCCESS' ? 'text-cyber-neon font-bold' : action.status === 'PENDING' ? 'text-yellow-400' : 'text-cyber-glitch font-bold'}>
                        ({action.status})
                      </span>
                    </span>
                  </div>
                ))}
                {globalFeed.length === 0 && <div className="text-cyber-neon/30">En attente d'actions globales...</div>}
              </div>
              <div className="mt-4 pt-2 border-t border-cyber-neon/30 flex gap-2 items-center opacity-70">
                <span className="animate-pulse">_</span> Réseau synchronisé
              </div>
            </div>
          </div>
          
        </aside>

      </main>
    </div>
  );
}

export default App;
