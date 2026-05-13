import React, { useState } from 'react';
import { Terminal } from 'lucide-react';

export const AuthScreen = ({ onLogin }: { onLogin: (playerId: string) => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    
    // API_URL should be available via VITE_API_URL or relative
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem('cyber_player_id', data.player_id);
        onLogin(data.player_id);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Erreur de connexion au serveur d'authentification.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 p-12 border-2 border-cyber-neon bg-cyber-dark/80 max-w-md w-full shadow-neon">
        <div className="flex items-center gap-2">
          <Terminal className="text-cyber-neon" size={32} />
          <h1 className="text-2xl tracking-[0.3em] font-bold text-white">CYBER-COURTIER</h1>
        </div>
        
        <h2 className="text-cyber-neon tracking-widest">{isLogin ? 'IDENTIFICATION REQUISE' : 'NOUVEL ENREGISTREMENT'}</h2>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <input 
            type="text" 
            placeholder="Nom d'utilisateur" 
            className="w-full bg-black/50 border border-cyber-neon/50 text-white p-3 font-mono focus:border-cyber-neon focus:outline-none"
            value={username} onChange={e => setUsername(e.target.value)} required
          />
          <input 
            type="password" 
            placeholder="Mot de passe" 
            className="w-full bg-black/50 border border-cyber-neon/50 text-white p-3 font-mono focus:border-cyber-neon focus:outline-none"
            value={password} onChange={e => setPassword(e.target.value)} required
          />
          
          {error && <div className="text-cyber-glitch text-sm text-center font-bold">{error}</div>}
          
          <button type="submit" disabled={loading} className="w-full cyber-button py-3 mt-2 font-bold tracking-widest flex justify-center items-center">
            {loading ? 'TRAITEMENT...' : (isLogin ? '[ CONNEXION ]' : '[ CRÉER UN DECK ]')}
          </button>
        </form>

        <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-gray-400 hover:text-cyber-neon transition-colors mt-2">
          {isLogin ? "Pas encore de profil ? S'enregistrer" : "Déjà enregistré ? Se connecter"}
        </button>
      </div>
    </div>
  );
};
