import { useEffect, useState } from 'react';
import { Terminal, Shield, Zap, Activity } from 'lucide-react';
import { Leaderboard } from './components/Leaderboard';
import { ClassSelectionModal } from './components/ClassSelectionModal';
import { AuthScreen } from './components/AuthScreen';

interface Player {
  username: string;
  credits: number;
  level: number;
  xp: number;
  class: string | null;
  active_exploit: string | null;
}

interface Server {
  id: string;
  name: string;
  security_level: number;
  base_cost?: number;
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

interface Hardware {
  id: string;
  slot: string;
  name: string;
  bonus_type: string;
  bonus_value: number;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  
  useEffect(() => {
    const savedPid = localStorage.getItem('cyber_player_id');
    if (savedPid) {
      setPlayerId(savedPid);
      setIsAuthenticated(true);
    }
  }, []);

  const [player, setPlayer] = useState<Player | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [globalFeed, setGlobalFeed] = useState<GlobalAction[]>([]);
  const [hardware, setHardware] = useState<Hardware[]>([]);
  const [items, setItems] = useState<{item_id: string, quantity: number}[]>([]);
  const [resources, setResources] = useState<{name: string, quantity: number}[]>([]);
  const [activeTab, setActiveTab] = useState<'market' | 'inventory' | 'atelier'>('market');
  const [scanCooldown, setScanCooldown] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [isMoneyFlash, setIsMoneyFlash] = useState(false);
  const [injectingId, setInjectingId] = useState<string | null>(null);
  const [glitchingServers, setGlitchingServers] = useState<Set<string>>(new Set());

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setLogs(prev => [{ id: Math.random().toString(), time: timeStr, message, type }, ...prev].slice(0, 15));
  };

  const fetchData = async () => {
    if (!playerId) return;
    try {
      const [playerRes, serversRes, recentRes, hardwareRes, resourcesRes, itemsRes] = await Promise.all([
        fetch(`${API_URL}/player/${playerId}`, { headers: { 'ngrok-skip-browser-warning': 'true' } }),
        fetch(`${API_URL}/servers`, { headers: { 'ngrok-skip-browser-warning': 'true' } }),
        fetch(`${API_URL}/actions/recent`, { headers: { 'ngrok-skip-browser-warning': 'true' } }),
        fetch(`${API_URL}/player/hardware/${playerId}`, { headers: { 'ngrok-skip-browser-warning': 'true' } }),
        fetch(`${API_URL}/player/resources/${playerId}`, { headers: { 'ngrok-skip-browser-warning': 'true' } }),
        fetch(`${API_URL}/player/items/${playerId}`, { headers: { 'ngrok-skip-browser-warning': 'true' } })
      ]);

      if (playerRes.ok) {
        const pData = await playerRes.json();
        console.log("Stats Joueur :", pData);
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
        console.log("Cibles reçues:", sData);
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

            const newActions = recentData.filter((r: any) => !prev.find(p => p.id === r.id));
            const newAnnihilations = newActions.filter((a: any) => a.status === 'ANNIHILATED');
            if (newAnnihilations.length > 0) {
              setGlitchingServers(new Set(newAnnihilations.map((a: any) => a.server_name)));
              setTimeout(() => setGlitchingServers(new Set()), 1000);
            }
          }
          return recentData;
        });
      } else {
        console.error("RECENT ACTIONS API ERROR:", await recentRes.text());
      }

      if (hardwareRes.ok) {
        setHardware(await hardwareRes.json());
      }

      if (resourcesRes.ok) {
        setResources(await resourcesRes.json());
      }
      
      if (itemsRes.ok) {
        setItems(await itemsRes.json());
      }
    } catch (error) {
      console.error("Erreur de connexion API:", error);
    }
  };

  useEffect(() => {
    if (!playerId) return;
    
    fetchData();
    const interval = setInterval(fetchData, 5000);
    setIsLive(true);

    return () => clearInterval(interval);
  }, [playerId]);

  useEffect(() => {
    if (!playerId) return;
    
    const cdInterval = setInterval(() => {
      setScanCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(cdInterval);
  }, [playerId]);

  const handleInject = async (serverId: string, packetId: string, serverName: string, cost: number) => {
    if (!player || player.credits < cost) {
      addLog(`ÉCHEC: Fonds insuffisants pour le déploiement (${cost} ¤ requis).`, "error");
      return;
    }

    setInjectingId(serverId);

    try {
      const res = await fetch(`${API_URL}/actions/attack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ player_id: playerId, packet_id: packetId })
      });

      const data = await res.json();

      if (res.ok) {
        addLog(`Injection de malware sur ${serverName} réussie. [ID: ${data.action_id.split('-')[0]}]`, "success");
        fetchData();
      } else {
        addLog(`ERREUR: ${data.error}`, "error");
      }
    } catch (err) {
      console.error(err);
      addLog(`FATAL: Connexion au serveur central perdue.`, "error");
    } finally {
      setTimeout(() => setInjectingId(null), 400);
    }
  };

  const handleSelectClass = async (playerClass: string) => {
    try {
      const res = await fetch(`${API_URL}/player/select-class`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ player_id: playerId, player_class: playerClass })
      });
      if (res.ok) {
        addLog(`Spécialisation validée : ${playerClass}`, "success");
        fetchData();
      } else {
        addLog(`Erreur lors du choix de classe.`, "error");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBuyUpgrade = async (upgradeId: string, cost: number) => {
    try {
      const res = await fetch(`${API_URL}/player/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ player_id: playerId, upgrade_id: upgradeId, cost })
      });
      if (res.ok) {
        addLog(`Upgrade acheté avec succès.`, "success");
        fetchData();
      } else {
        const errData = await res.json();
        addLog(`Erreur achat : ${errData.error}`, "error");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBuyHardware = async (slot: string, name: string, bonusType: string, bonusValue: number, cost: number) => {
    try {
      const res = await fetch(`${API_URL}/player/buy-hardware`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ player_id: playerId, slot, name, bonus_type: bonusType, bonus_value: bonusValue, cost })
      });
      if (res.ok) {
        addLog(`Hardware installé : ${name}`, "success");
        fetchData();
      } else {
        const errData = await res.json();
        addLog(`Erreur achat : ${errData.error}`, "error");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleScan = async () => {
    if (scanCooldown > 0) return;
    try {
      const res = await fetch(`${API_URL}/player/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ player_id: playerId })
      });
      const data = await res.json();
      if (res.ok) {
        addLog(data.message, "success");
        setScanCooldown(30);
        fetchData();
      } else {
        addLog(`Erreur scan : ${data.error}`, "error");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRecycle = async () => {
    try {
      const res = await fetch(`${API_URL}/player/recycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ player_id: playerId })
      });
      const data = await res.json();
      if (res.ok) {
        addLog(data.message, "success");
        fetchData();
      } else {
        addLog(`Erreur recyclage : ${data.error}`, "error");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCraft = async (itemId: string, cost: number) => {
    try {
      const res = await fetch(`${API_URL}/player/craft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ player_id: playerId, item_id: itemId, cost })
      });
      const data = await res.json();
      if (res.ok) {
        addLog(data.message, "success");
        fetchData();
      } else {
        addLog(`Erreur craft : ${data.error}`, "error");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUseItem = async (itemId: string) => {
    try {
      const res = await fetch(`${API_URL}/player/use-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ player_id: playerId, item_id: itemId })
      });
      const data = await res.json();
      if (res.ok) {
        addLog(data.message, "success");
        fetchData();
      } else {
        addLog(`Erreur activation : ${data.error}`, "error");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetSession = async () => {
    try {
      const res = await fetch(`${API_URL}/session/reset`, { 
        method: 'POST',
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok) {
        addLog("Session système redémarrée. Nouveau deck assigné.", "success");
        fetchData();
      } else {
        addLog("Erreur lors du redémarrage de la session.", "error");
      }
    } catch (err) {
      console.error(err);
      addLog("FATAL: Impossible de contacter l'API pour le reset.", "error");
    }
  };

  const handleLogin = (pid: string) => {
    setPlayerId(pid);
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-cyber-dark text-white font-mono flex flex-col relative">
      <div className="scanlines"></div>

      {player && player.level >= 2 && !player.class && (
        <ClassSelectionModal onSelectClass={handleSelectClass} />
      )}

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
        <div className="flex gap-8 text-sm md:text-base border border-cyber-neon/50 px-6 py-2 bg-black/50 shadow-neon items-center">
          <div className="flex flex-col min-w-[200px]">
            <div>IDENTITÉ: <span className="font-bold text-white">{player ? player.username.toUpperCase() : 'ANTON'}</span></div>
            {player && (
              <div className="text-xs text-cyber-neon mt-1">
                <div className="flex justify-between">
                  <span>LVL {player.level} {player.class && `| ${player.class}`}</span>
                  <span>{player.xp}/1000 XP</span>
                </div>
                <div className="h-1.5 w-full bg-cyber-neon/20 mt-1 overflow-hidden">
                  <div className="h-full bg-cyber-neon transition-all duration-500" style={{ width: `${(player.xp / 1000) * 100}%` }}></div>
                </div>
                {player.active_exploit && (
                  <div className="mt-1 text-cyber-neon bg-cyber-neon/10 border border-cyber-neon/30 px-1 py-0.5 inline-block rounded font-bold animate-pulse">
                    ⚡ {player.active_exploit.toUpperCase()} ACTIF
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center">CRÉDITS: <span className={`ml-2 font-bold text-cyber-neon ${isMoneyFlash ? 'animate-money-flash' : ''}`}>{player ? player.credits : '0'}</span> ¤</div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row p-4 gap-6 overflow-hidden z-20">

        {/* Servers Grid */}
        <section className="flex-1 flex flex-col gap-4 min-h-0">
          <div className="flex justify-between items-center border-b border-white/20 pb-2">
            <h2 className="text-lg tracking-widest flex items-center gap-2">
              <Activity size={18} /> CIBLES MATRICIELLES
            </h2>
            <button 
              onClick={handleScan}
              disabled={scanCooldown > 0}
              className={`px-4 py-1 border text-sm font-bold tracking-widest transition-colors ${scanCooldown > 0 ? 'border-gray-600 text-gray-500 cursor-not-allowed' : 'border-cyber-neon text-cyber-neon hover:bg-cyber-neon hover:text-black'}`}
            >
              {scanCooldown > 0 ? `SCAN EN RECHARGE (${scanCooldown}S)` : 'SCANNER LE RÉSEAU'}
            </button>
          </div>

          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto pr-2 pb-10">
            {servers.length === 0 ? (
              <div className="text-cyber-neon/50 animate-pulse">Recherche de cibles...</div>
            ) : (
              servers.map(server => {
                const cost = (server.base_cost || 100) * server.security_level;
                const isGlitching = glitchingServers.has(server.id);
                return (
                  <div key={server.id} className={`cyber-panel p-5 flex flex-col gap-4 group ${isGlitching ? 'animate-cyber-glitch border-cyber-glitch' : ''}`}>
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
                      {server.id === 'srv-vault' && player && player.level < 5 ? (
                        <button disabled className="w-full cyber-button flex justify-center items-center gap-2 group opacity-50 cursor-not-allowed border-cyber-glitch text-cyber-glitch/80 hover:bg-transparent hover:text-cyber-glitch/80">
                          🔒 Requis : Tier 5
                        </button>
                      ) : (
                        <button
                          onClick={() => handleInject(server.id, `pkt-1`, server.name, cost)}
                          disabled={injectingId === server.id}
                          className={`w-full cyber-button flex justify-center items-center gap-2 group ${injectingId === server.id ? 'animate-glitch bg-cyber-neon text-black' : ''}`}
                        >
                          <Zap size={16} />
                          {injectingId === server.id ? 'INJECTION EN COURS...' : `[ INJECTER VIRUS (${cost} ¤) ]`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Side Panel - Logs */}
        <aside className="w-full md:w-80 lg:w-96 flex flex-col gap-4 h-full overflow-hidden">

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

          {/* Leaderboard */}
          <Leaderboard />

          {/* SYSTEME D'ONGLETS */}
          <div className="flex flex-col gap-2 flex-none min-h-[250px]">
            <div className="flex border-b border-white/20">
              <button onClick={() => setActiveTab('market')} className={`flex-1 py-2 text-sm font-bold tracking-widest transition-colors ${activeTab === 'market' ? 'border-b-2 border-cyber-neon text-white' : 'text-gray-500 hover:text-gray-300'}`}>MARCHÉ</button>
              <button onClick={() => setActiveTab('inventory')} className={`flex-1 py-2 text-sm font-bold tracking-widest transition-colors ${activeTab === 'inventory' ? 'border-b-2 border-cyber-neon text-white' : 'text-gray-500 hover:text-gray-300'}`}>INVENTAIRE</button>
              <button onClick={() => setActiveTab('atelier')} className={`flex-1 py-2 text-sm font-bold tracking-widest transition-colors ${activeTab === 'atelier' ? 'border-b-2 border-cyber-neon text-white' : 'text-gray-500 hover:text-gray-300'}`}>ATELIER</button>
            </div>
            
            <div className="glass-panel p-4 flex flex-col gap-2 flex-1 overflow-y-auto">
              {activeTab === 'market' && (
                <div className="flex flex-col gap-2">
                  <button onClick={() => handleBuyUpgrade('botnet', 5000)} className="w-full border border-white/20 flex justify-between items-center p-3 hover:bg-white/10 hover:border-white/50 transition-colors">
                    <span className="font-bold tracking-widest text-sm text-white">Extension Botnet</span>
                    <span className="text-xs text-cyber-neon">[ 5 000 ¤ ]</span>
                  </button>
                  <button onClick={() => handleBuyHardware('CPU', 'CPU Overclocké', 'CREDITS', 20, 10000)} className="w-full border border-white/20 flex justify-between items-center p-3 hover:bg-white/10 hover:border-white/50 transition-colors">
                    <span className="font-bold tracking-widest text-sm text-white">🔋 CPU Overclocké (+20% Cr)</span>
                    <span className="text-xs text-cyber-neon">[ 10 000 ¤ ]</span>
                  </button>
                  <button onClick={() => handleBuyHardware('RAM', 'Module RAM Furtif', 'PENALTY', 50, 15000)} className="w-full border border-white/20 flex justify-between items-center p-3 hover:bg-white/10 hover:border-white/50 transition-colors">
                    <span className="font-bold tracking-widest text-sm text-white">💾 RAM Furtive (-50% Pén)</span>
                    <span className="text-xs text-cyber-neon">[ 15 000 ¤ ]</span>
                  </button>
                  <button onClick={() => handleBuyHardware('OS', 'Kernel Optimisé', 'XP', 15, 8000)} className="w-full border border-white/20 flex justify-between items-center p-3 hover:bg-white/10 hover:border-white/50 transition-colors">
                    <span className="font-bold tracking-widest text-sm text-white">⚙️ Kernel Optimisé (+15% XP)</span>
                    <span className="text-xs text-cyber-neon">[ 8 000 ¤ ]</span>
                  </button>
                </div>
              )}
              
              {activeTab === 'inventory' && (
                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-sm tracking-widest text-white/70 mb-2">/// HARDWARE</h3>
                    {hardware.length === 0 ? (
                      <div className="text-gray-400 text-xs italic text-center py-2">Aucun équipement installé...</div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {hardware.map((hw, i) => (
                          <div key={i} className="flex justify-between items-center bg-black/20 p-3 rounded border border-white/10">
                            <span className="text-white font-bold text-sm">
                              {hw.slot === 'CPU' ? '🔋' : hw.slot === 'RAM' ? '💾' : '⚙️'} {hw.name}
                            </span>
                            <span className="text-cyber-neon text-xs font-mono ml-2">
                              {hw.bonus_type === 'CREDITS' ? '+20%' : hw.bonus_type === 'PENALTY' ? '-50%' : '+15%'} {hw.bonus_type}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm tracking-widest text-white/70 mb-2">/// CONSOMMABLES</h3>
                    {items.length === 0 ? (
                      <div className="text-gray-400 text-xs italic text-center py-2">Aucun exploit en stock...</div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {items.map((it, i) => (
                          <div key={i} className="flex justify-between items-center bg-black/20 p-2 rounded border border-white/10">
                            <span className="text-white font-bold text-sm">📦 {it.item_id} (x{it.quantity})</span>
                            <button 
                              onClick={() => handleUseItem(it.item_id)}
                              disabled={!!player?.active_exploit}
                              className="px-3 py-1 bg-cyber-neon text-black text-xs font-bold hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              ACTIVER
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {activeTab === 'atelier' && (
                <div className="flex flex-col gap-4">
                  {/* En-tête avec les ressources disponibles */}
                  <div className="flex flex-col items-center py-2 border-b border-white/10">
                    <div className="text-gray-400 text-sm">Fragments de Code disponibles :</div>
                    <div className="text-3xl font-bold text-cyber-neon font-mono mt-1">
                      {resources.find(r => r.name === 'Fragments de Code')?.quantity || 0}
                    </div>
                  </div>

                  {/* Section 1 : COMPILATION (Crafting) */}
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm tracking-widest text-white/70">/// COMPILATION</h3>
                    <button 
                      onClick={() => handleCraft('bypass_v2', 10)}
                      disabled={(resources.find(r => r.name === 'Fragments de Code')?.quantity || 0) < 10}
                      className="w-full border border-white/20 flex justify-between items-center p-3 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                      <div className="flex flex-col items-start text-left">
                        <span className="font-bold tracking-widest text-sm text-white">📦 Exploit : Bypass_v2</span>
                        <span className="text-xs text-gray-400 mt-1">Garantit 100% de succès sur la prochaine attaque.</span>
                      </div>
                      <span className="text-xs text-cyber-neon group-hover:text-white transition-colors whitespace-nowrap ml-2">[ 10 Frags ]</span>
                    </button>
                  </div>

                  {/* Section 2 : RECYCLAGE */}
                  <div className="flex flex-col gap-2 mt-2">
                    <h3 className="text-sm tracking-widest text-white/70">/// RECYCLAGE</h3>
                    <button 
                      onClick={handleRecycle}
                      disabled={!resources.find(r => r.name === 'Fragments de Code') || resources.find(r => r.name === 'Fragments de Code')!.quantity === 0}
                      className="w-full py-3 border border-cyber-neon text-cyber-neon font-bold tracking-widest hover:bg-cyber-neon hover:text-black transition-colors disabled:border-gray-600 disabled:text-gray-500 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                    >
                      RECYCLER (20 ¤ / unité)
                    </button>
                  </div>
                </div>
              )}
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
