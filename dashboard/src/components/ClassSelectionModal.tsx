import { useState } from 'react';

interface ClassSelectionModalProps {
  onSelectClass: (playerClass: string) => void;
}

export function ClassSelectionModal({ onSelectClass }: ClassSelectionModalProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleConfirm = () => {
    if (selected) {
      onSelectClass(selected);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="cyber-panel p-8 max-w-4xl w-full border-2 border-cyber-neon shadow-[0_0_30px_#00ffcc] animate-pulse-slow">
        <h2 className="text-3xl font-bold text-cyber-neon tracking-[0.2em] mb-2 text-center">SYSTÈME DE SPÉCIALISATION</h2>
        <p className="text-gray-300 text-center mb-8">Niveau 2 atteint. Veuillez sélectionner votre profil neuronal pour poursuivre.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* ADMIN */}
          <div 
            onClick={() => setSelected('ADMIN')}
            className={`p-4 border cursor-pointer transition-all duration-300 flex flex-col items-center gap-4 hover:border-cyber-neon hover:shadow-[0_0_15px_#00ffcc] ${selected === 'ADMIN' ? 'bg-cyber-neon/20 border-cyber-neon shadow-[0_0_15px_#00ffcc]' : 'border-cyber-neon/30 bg-black/50'}`}
          >
            <div className="text-5xl mb-2">💻</div>
            <h3 className="font-bold text-white tracking-widest text-xl">ADMIN</h3>
            <p className="text-sm text-gray-300 text-center mt-2 leading-relaxed">Expert Réseau. Réduit le coût de TOUTES les injections de 50%.</p>
          </div>

          {/* BRUTE */}
          <div 
            onClick={() => setSelected('BRUTE')}
            className={`p-4 border cursor-pointer transition-all duration-300 flex flex-col items-center gap-4 hover:border-cyber-glitch hover:shadow-[0_0_15px_#ff003c] ${selected === 'BRUTE' ? 'bg-cyber-glitch/20 border-cyber-glitch shadow-[0_0_15px_#ff003c]' : 'border-cyber-neon/30 bg-black/50'}`}
          >
            <div className="text-5xl mb-2">🔨</div>
            <h3 className="font-bold text-cyber-glitch tracking-widest text-xl">BRUTE</h3>
            <p className="text-sm text-gray-300 text-center mt-2 leading-relaxed">Puissance de calcul brute. Multiplie les gains de crédits par 1.5.</p>
          </div>

          {/* GHOST */}
          <div 
            onClick={() => setSelected('GHOST')}
            className={`p-4 border cursor-pointer transition-all duration-300 flex flex-col items-center gap-4 hover:border-purple-500 hover:shadow-[0_0_15px_#a855f7] ${selected === 'GHOST' ? 'bg-purple-500/20 border-purple-500 shadow-[0_0_15px_#a855f7]' : 'border-cyber-neon/30 bg-black/50'}`}
          >
            <div className="text-5xl mb-2">👻</div>
            <h3 className="font-bold text-purple-400 tracking-widest text-xl">GHOST</h3>
            <p className="text-sm text-gray-300 text-center mt-2 leading-relaxed">Furtivité totale. Divise par 4 la pénalité de perte de crédits sur le Vault.</p>
          </div>
        </div>

        <button
          onClick={handleConfirm}
          disabled={!selected}
          className={`w-full py-4 font-bold tracking-widest text-xl transition-all duration-300 ${selected ? 'bg-cyber-neon text-black hover:bg-white shadow-[0_0_15px_#00ffcc]' : 'bg-cyber-neon/10 text-cyber-neon/30 cursor-not-allowed border border-cyber-neon/30'}`}
        >
          [ CONFIRMER LA SPÉCIALISATION ]
        </button>
      </div>
    </div>
  );
}
