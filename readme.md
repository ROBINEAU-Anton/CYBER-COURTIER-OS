# ⚡ CYBER-COURTIER OS v2.0

Bienvenue sur le Hub Opérationnel. Cyber-Courtier OS est une simulation économique asynchrone et un système distribué de "Guerre de l'Information". 
En tant que runner, votre mission est de déployer des malwares sur des serveurs matriciels pour extraire des paquets de données lucratifs dans un marché noir futuriste.

## 🏗️ Architecture Hybride & Distributed Stack

Ce projet tourne sur une infrastructure distribuée alliant performances et flexibilité :
- **Frontend (PC Local)** : Dashboard en React (Vite) avec UI/UX Neon-Cyberpunk.
- **Backend APIs (PC Local via Docker)** : `api-gateway` et `sim-engine` construits en Node.js/TypeScript.
- **Game Engine (PC Local via Docker)** : `game-worker` (Tick-Engine) ultra-rapide codé en Go (Golang) pour gérer la file d'attente et résoudre les conflits.
- **Data Layer (Raspberry Pi - 192.168.1.96)** : 
  - PostgreSQL pour la persistance absolue des profils, transactions, et audits, synchronisé en temps réel.
  - Redis pour la `actions_queue` en mémoire, ingérant des centaines d'actions par seconde avant le Tick final.

## 🌐 Multiplayer & Real-time Leaderboard

La Phase 2.0 transforme l'expérience en une véritable guerre multijoueur :
- **Identité Persistante via UUID** : Chaque runner se voit assigner un identifiant unique (UUID) stocké localement, garantissant la persistance de l'identité et du solde à travers les sessions.
- **Leaderboard en Temps Réel** : Un système de polling permet de suivre en direct l'ascension des meilleurs runners de la Matrice.
- **Exposition Externe (Ngrok/Localtunnel)** : Pour permettre aux runners du monde entier de se connecter, le backend et le frontend sont exposés de manière sécurisée via des tunnels Ngrok et Localtunnel. N'oubliez pas de configurer vos variables `.env` (ex: `VITE_API_URL`).

## 🕹️ Mécaniques de Jeu & Économie

### 1. Grid Architecture & Typologie des Serveurs
La matrice est désormais segmentée en trois types d'infrastructures (Grid Architecture) offrant des rendements et des risques différents :
- **Proxy (`srv-proxy`)** : Faible coût, risque modéré, idéal pour les attaques de masse.
- **Mainframe (`srv-mainframe`)** : Le cœur des systèmes corporatistes. Grosse rentabilité mais haute sécurité.
- **Vault (`srv-vault`)** : Réserves de données inestimables. Très difficiles d'accès, une erreur y est fatale.

### 2. Annihilation Mutuelle (Surcharge Réseau)
Pour garantir l'équilibre et la furtivité, le moteur utilise une règle stricte :
- Si un seul agent cible un paquet de données durant un **Tick**, l'extraction est un *SUCCESS*.
- Si plusieurs agents ciblent le même paquet simultanément, une **surcharge réseau** (Annihilation) est déclenchée. Toutes les actions échouent et le serveur cible entre en alerte (augmentation de son *Security Level*).

### 3. Économie Dynamique & Pénalités
Les serveurs évoluent. Plus ils sont attaqués, plus ils se défendent :
- **Coût d'Injection** : Calculé dynamiquement selon la formule `Coût = SecurityLevel * 100 ¤`.
- **Récompense de Succès** : Si votre virus passe sous les radars, vous touchez le jackpot proportionnel au risque.
- **Pénalité sur le Vault** : Les serveurs de type *Vault* disposent de contre-mesures redoutables. Si une attaque échoue sur un Vault, une **pénalité de 20%** sur l'ensemble de votre solde vous est immédiatement infligée.
- **Trace Détectée** : Attention au *System Failure* (Solde < 0) !

## 🚀 Lancement Rapide (Déploiement Flash)

L'ensemble de la stack est dockerisé pour une mise en route instantanée.

1. **Pré-requis** : Assurez-vous d'avoir Docker & Docker Compose d'installés sur votre machine hôte (PC) et que votre Raspberry Pi (192.168.1.96) fait bien tourner PostgreSQL et Redis.
2. **Boot Sequence** : À la racine du projet, lancez simplement le script prévu à cet effet :
   ```bash
   .\start.bat
   ```
3. **Exposition Multijoueur** :
   ```bash
   npx localtunnel --port 5173
   npx ngrok http 3000
   ```
4. **Accès au Hub** : Ouvrez votre navigateur sur l'URL de votre tunnel (ou en local sur [http://localhost:5173](http://localhost:5173)).

> "La Matrice est à vous. Ne laissez pas votre deck griller."