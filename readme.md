# ⚡ CYBER-COURTIER OS v1.0

Bienvenue sur le Hub Opérationnel. Cyber-Courtier OS est une simulation économique asynchrone et un système distribué de "Guerre de l'Information". 
En tant que runner, votre mission est de déployer des malwares sur des serveurs matriciels pour extraire des paquets de données lucratifs dans un marché noir futuriste.

## 🏗️ Architecture Hybride & Distributed Stack

Ce projet tourne sur une infrastructure distribuée alliant performances et flexibilité :
- **Frontend (PC Local)** : Dashboard en React (Vite) avec UI/UX Neon-Cyberpunk.
- **Backend APIs (PC Local via Docker)** : `api-gateway` et `sim-engine` construits en Node.js/TypeScript.
- **Game Engine (PC Local via Docker)** : `game-worker` (Tick-Engine) ultra-rapide codé en Go (Golang) pour gérer la file d'attente et résoudre les conflits.
- **Data Layer (Raspberry Pi - 192.168.1.96)** : 
  - PostgreSQL pour la persistance absolue des profils, transactions, et audits.
  - Redis pour la `actions_queue` en mémoire, ingérant des centaines d'actions par seconde avant le Tick final.

## 🕹️ Mécaniques de Jeu & Économie

### 1. Annihilation Mutuelle (Surcharge Réseau)
Pour garantir l'équilibre et la furtivité, le moteur utilise une règle stricte :
- Si un seul agent cible un paquet de données durant un **Tick**, l'extraction est un *SUCCESS*.
- Si plusieurs agents ciblent le même paquet simultanément, une **surcharge réseau** (Annihilation) est déclenchée. Toutes les actions échouent et le serveur cible entre en alerte (augmentation de son *Security Level*).

### 2. Économie Dynamique & Rendement
Les serveurs évoluent. Plus ils sont attaqués, plus ils se défendent :
- **Coût d'Injection** : Calculé dynamiquement selon la formule `Coût = SecurityLevel * 100 ¤`.
- **Récompense de Succès** : Si votre virus passe sous les radars, vous touchez le jackpot proportionnel au risque : `Gain = Value * (SecurityLevel / 10)`.
- **Trace Détectée (Pénalité)** : Si votre action est annihilée sur un serveur de haute sécurité (`SecurityLevel > 20`), vous subissez une amende immédiate de 500 crédits. Attention au *System Failure* (Solde < 0) !

## 🚀 Lancement Rapide (Déploiement Flash)

L'ensemble de la stack est dockerisé pour une mise en route instantanée.

1. **Pré-requis** : Assurez-vous d'avoir Docker & Docker Compose d'installés sur votre machine hôte (PC) et que votre Raspberry Pi (192.168.1.96) fait bien tourner PostgreSQL et Redis.
2. **Boot Sequence** : À la racine du projet, lancez simplement le script prévu à cet effet :
   ```bash
   .\start.bat
   ```
   *(Ou lancez `docker compose up --build -d` manuellement).*
3. **Accès au Hub** : Ouvrez votre navigateur sur [http://localhost:5173](http://localhost:5173).

> "La Matrice est à vous. Ne laissez pas votre deck griller."