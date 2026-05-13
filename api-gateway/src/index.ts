import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// Configuration de l'environnement
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost:5432/dbname';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Initialisation des clients
const dbPool = new Pool({ connectionString: DATABASE_URL });
const redis = new Redis(REDIS_URL);

// Initialisation de Fastify
const fastify = Fastify({ logger: true });

// Configuration de CORS pour autoriser le frontend Vite
fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning']
});

// Typage pour la requête
interface AttackRequest {
  Body: {
    player_id: string;
    packet_id: string;
  };
}

// Route POST /actions/attack
fastify.post<AttackRequest>('/actions/attack', async (request, reply) => {
  const { player_id, packet_id } = request.body;

  if (!player_id || !packet_id) {
    return reply.status(400).send({ error: "Syntaxe de commande invalide : player_id et packet_id requis." });
  }

  // Ouverture d'un client dédié pour gérer la transaction
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');

    // 1. Fetch packet info and target server security_level
    const packetResult = await client.query(`
      SELECT dp.target_server_id, ts.security_level, ts.base_cost 
      FROM data_packets dp 
      JOIN target_servers ts ON dp.target_server_id = ts.id 
      WHERE dp.id = $1
    `, [packet_id]);
    
    if (packetResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return reply.status(400).send({ error: "Cible fantôme : le paquet de données est introuvable sur la Matrice." });
    }

    const targetServerId = packetResult.rows[0].target_server_id;
    const securityLevel = packetResult.rows[0].security_level;
    const baseCost = packetResult.rows[0].base_cost;
    const injectionCost = baseCost * securityLevel;

    // 2. Vérification du joueur (avec FOR UPDATE pour verrouiller la ligne)
    const playerResult = await client.query('SELECT credits, class FROM players WHERE id = $1 FOR UPDATE', [player_id]);
    
    if (playerResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return reply.status(400).send({ error: "Connexion neuronale refusée : identifiant runner inconnu." });
    }

    const credits = playerResult.rows[0].credits;
    const playerClass = playerResult.rows[0].class;
    
    let finalCost = injectionCost;
    if (playerClass === 'ADMIN') {
      finalCost = Math.floor(injectionCost / 2);
    }

    if (credits < finalCost) {
      await client.query('ROLLBACK');
      return reply.status(400).send({ error: `Fonds insuffisants. Coût de l'injection : ${finalCost} ¤.` });
    }

    // 3. Débit des crédits
    await client.query('UPDATE players SET credits = credits - $2 WHERE id = $1', [player_id, finalCost]);

    // 4. Création de l'action Virus en base de données et dans la file Redis
    const actionId = uuidv4();
    await client.query(
      `INSERT INTO virus_actions (id, player_id, target_server_id, packet_id, status) VALUES ($1, $2, $3, $4, 'PENDING')`,
      [actionId, player_id, targetServerId, packet_id]
    );

    // Validation de la transaction SQL
    await client.query('COMMIT');

    const actionPayload = {
      ID: actionId,
      PlayerID: player_id,
      TargetServerID: targetServerId,
      PacketID: packet_id
    };

    await redis.lpush('actions_queue', JSON.stringify(actionPayload));

    fastify.log.info({ actionId, player_id }, "Virus action déployée avec succès.");

    return reply.status(200).send({
      message: "Exécutable injecté. En attente de la résolution du prochain Tick serveur.",
      action_id: actionId
    });

  } catch (error) {
    await client.query('ROLLBACK');
    fastify.log.error(error);
    return reply.status(500).send({ error: "Erreur critique du système central. Opération annulée." });
  } finally {
    client.release();
  }
});

// Route GET /player/:id pour le Dashboard
interface PlayerParams {
  Params: {
    id: string;
  };
}

fastify.get<PlayerParams>('/player/:id', async (request, reply) => {
  const { id } = request.params;
  const client = await dbPool.connect();

  try {
    const result = await client.query('SELECT username, credits, level, xp, class, active_exploit FROM players WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: "Profil neuronal introuvable." });
    }
    
    return reply.status(200).send(result.rows[0]);
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: "Erreur lors de la lecture des données matricielles." });
  } finally {
    client.release();
  }
});

// Auth routes
interface AuthRequest {
  Body: {
    username: string;
    password?: string;
  };
}

fastify.post<AuthRequest>('/auth/register', async (request, reply) => {
  const { username, password } = request.body;
  if (!username || !password) {
    return reply.status(400).send({ error: "username et password requis" });
  }

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if user exists
    const checkRes = await client.query('SELECT id FROM users WHERE username = $1', [username]);
    if (checkRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return reply.status(400).send({ error: "Ce nom d'utilisateur est déjà pris." });
    }

    const userId = uuidv4();
    const hash = await bcrypt.hash(password, 10);

    // Insert user
    await client.query(
      'INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)',
      [userId, username, hash]
    );

    // Create initial player profile
    await client.query(
      'INSERT INTO players (id, name, username, credits, level, xp) VALUES ($1, $2, $3, 5000, 1, 0)',
      [userId, username, username]
    );

    await client.query('COMMIT');
    return reply.status(201).send({ message: "Nouveau runner enregistré", player_id: userId, username });
  } catch (error) {
    await client.query('ROLLBACK');
    fastify.log.error(error);
    return reply.status(500).send({ error: "Erreur d'enregistrement" });
  } finally {
    client.release();
  }
});

fastify.post<AuthRequest>('/auth/login', async (request, reply) => {
  const { username, password } = request.body;
  if (!username || !password) {
    return reply.status(400).send({ error: "username et password requis" });
  }

  const client = await dbPool.connect();
  try {
    const res = await client.query('SELECT id, password_hash FROM users WHERE username = $1', [username]);
    if (res.rows.length === 0) {
      return reply.status(401).send({ error: "Identifiants invalides." });
    }

    const user = res.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    
    if (!match) {
      return reply.status(401).send({ error: "Identifiants invalides." });
    }

    return reply.status(200).send({ message: "Connexion réussie", player_id: user.id });
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: "Erreur de connexion" });
  } finally {
    client.release();
  }
});

interface SelectClassRequest {
  Body: {
    player_id: string;
    player_class: string;
  };
}

fastify.post<SelectClassRequest>('/player/select-class', async (request, reply) => {
  const { player_id, player_class } = request.body;
  if (!player_id || !player_class) {
    return reply.status(400).send({ error: "player_id et player_class requis" });
  }

  const validClasses = ['ADMIN', 'BRUTE', 'GHOST'];
  if (!validClasses.includes(player_class)) {
    return reply.status(400).send({ error: "Classe invalide" });
  }

  const client = await dbPool.connect();
  try {
    const result = await client.query('UPDATE players SET class = $1 WHERE id = $2 AND class IS NULL', [player_class, player_id]);
    // Note: rowCount requires result.rowCount, verify it exists. Yes it does in pg.
    if (result.rowCount === 0) {
      return reply.status(400).send({ error: "Impossible de changer de classe ou joueur introuvable." });
    }
    return reply.status(200).send({ message: "Classe sélectionnée avec succès !" });
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: "Erreur lors de la sélection de la classe." });
  } finally {
    client.release();
  }
});

interface UpgradeRequest {
  Body: {
    player_id: string;
    upgrade_id: string;
    cost: number;
  };
}

fastify.post<UpgradeRequest>('/player/upgrade', async (request, reply) => {
  const { player_id, upgrade_id, cost } = request.body;
  if (!player_id || !upgrade_id || !cost) {
    return reply.status(400).send({ error: "Paramètres manquants" });
  }

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    const playerRes = await client.query('SELECT credits FROM players WHERE id = $1 FOR UPDATE', [player_id]);
    if (playerRes.rows.length === 0 || playerRes.rows[0].credits < cost) {
      await client.query('ROLLBACK');
      return reply.status(400).send({ error: "Fonds insuffisants ou joueur introuvable." });
    }

    await client.query('UPDATE players SET credits = credits - $1 WHERE id = $2', [cost, player_id]);
    
    await client.query(`
      INSERT INTO player_upgrades (player_id, upgrade_id, level)
      VALUES ($1, $2, 1)
      ON CONFLICT (player_id, upgrade_id)
      DO UPDATE SET level = player_upgrades.level + 1
    `, [player_id, upgrade_id]);

    await client.query('COMMIT');
    return reply.status(200).send({ message: "Upgrade acheté avec succès !" });
  } catch (error) {
    await client.query('ROLLBACK');
    fastify.log.error(error);
    return reply.status(500).send({ error: "Erreur lors de l'achat de l'upgrade." });
  } finally {
    client.release();
  }
});

fastify.get<PlayerParams>('/player/hardware/:id', async (request, reply) => {
  const { id } = request.params;
  const client = await dbPool.connect();
  try {
    const result = await client.query('SELECT id, slot, name, bonus_type, bonus_value FROM player_hardware WHERE player_id = $1', [id]);
    return reply.status(200).send(result.rows);
  } catch (error) {
    fastify.log.error(error);
    return reply.status(200).send([]); // Evite de crasher le dashboard si la table n'existe pas encore
  } finally {
    client.release();
  }
});

interface BuyHardwareRequest {
  Body: {
    player_id: string;
    slot: string;
    name: string;
    bonus_type: string;
    bonus_value: number;
    cost: number;
  };
}

fastify.post<BuyHardwareRequest>('/player/buy-hardware', async (request, reply) => {
  const { player_id, slot, name, bonus_type, bonus_value, cost } = request.body;
  if (!player_id || !slot || !name || !cost) {
    return reply.status(400).send({ error: "Paramètres manquants" });
  }

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    const playerRes = await client.query('SELECT credits FROM players WHERE id = $1 FOR UPDATE', [player_id]);
    if (playerRes.rows.length === 0 || playerRes.rows[0].credits < cost) {
      await client.query('ROLLBACK');
      return reply.status(400).send({ error: "Fonds insuffisants." });
    }

    await client.query('UPDATE players SET credits = credits - $1 WHERE id = $2', [cost, player_id]);
    
    // On remplace l'équipement existant sur ce slot
    await client.query('DELETE FROM player_hardware WHERE player_id = $1 AND slot = $2', [player_id, slot]);

    await client.query(`
      INSERT INTO player_hardware (player_id, slot, name, bonus_type, bonus_value)
      VALUES ($1, $2, $3, $4, $5)
    `, [player_id, slot, name, bonus_type, bonus_value]);

    await client.query('COMMIT');
    return reply.status(200).send({ message: "Hardware installé avec succès !" });
  } catch (error) {
    await client.query('ROLLBACK');
    fastify.log.error(error);
    return reply.status(500).send({ error: "Erreur lors de l'achat du hardware." });
  } finally {
    client.release();
  }
});

// Route GET /servers pour le Dashboard
fastify.get('/servers', async (request, reply) => {
  const client = await dbPool.connect();

  try {
    const result = await client.query('SELECT id, name, security_level, base_cost FROM target_servers ORDER BY name ASC');
    return reply.status(200).send(result.rows);
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: "Erreur lors du balayage du réseau." });
  } finally {
    client.release();
  }
});

interface ScanRequest {
  Body: {
    player_id: string;
  };
}

fastify.post<ScanRequest>('/player/scan', async (request, reply) => {
  const { player_id } = request.body;
  if (!player_id) return reply.status(400).send({ error: "player_id requis" });

  const client = await dbPool.connect();
  try {
    const playerRes = await client.query('SELECT job_scraper_lvl FROM players WHERE id = $1', [player_id]);
    if (playerRes.rows.length === 0) return reply.status(404).send({ error: "Joueur introuvable." });
    
    const scraperLvl = playerRes.rows[0].job_scraper_lvl || 1;
    const fragments = Math.floor(Math.random() * 5 + 1) * scraperLvl;
    
    await client.query(`
      INSERT INTO resources (player_id, name, quantity)
      VALUES ($1, 'Fragments de Code', $2)
      ON CONFLICT (player_id, name)
      DO UPDATE SET quantity = resources.quantity + EXCLUDED.quantity
    `, [player_id, fragments]);
    
    return reply.status(200).send({ message: `Scan terminé. +${fragments} Fragments.` });
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: "Erreur lors du scan réseau." });
  } finally {
    client.release();
  }
});

interface RecycleRequest {
  Body: {
    player_id: string;
  };
}

fastify.post<RecycleRequest>('/player/recycle', async (request, reply) => {
  const { player_id } = request.body;
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    
    const resQuery = await client.query(`
      SELECT quantity FROM resources WHERE player_id = $1 AND name = 'Fragments de Code' FOR UPDATE
    `, [player_id]);
    
    if (resQuery.rows.length === 0 || resQuery.rows[0].quantity === 0) {
      await client.query('ROLLBACK');
      return reply.status(400).send({ error: "Aucun fragment à recycler." });
    }
    
    const qty = resQuery.rows[0].quantity;
    const creditsWon = qty * 20;
    
    await client.query('UPDATE resources SET quantity = 0 WHERE player_id = $1 AND name = $2', [player_id, 'Fragments de Code']);
    await client.query('UPDATE players SET credits = credits + $1 WHERE id = $2', [creditsWon, player_id]);
    
    await client.query('COMMIT');
    return reply.status(200).send({ message: `Recyclage réussi. +${creditsWon} ¤.` });
  } catch (error) {
    await client.query('ROLLBACK');
    fastify.log.error(error);
    return reply.status(500).send({ error: "Erreur lors du recyclage." });
  } finally {
    client.release();
  }
});

fastify.get<PlayerParams>('/player/resources/:id', async (request, reply) => {
  const { id } = request.params;
  const client = await dbPool.connect();
  try {
    const result = await client.query('SELECT name, quantity FROM resources WHERE player_id = $1', [id]);
    return reply.status(200).send(result.rows);
  } catch (error) {
    fastify.log.error(error);
    return reply.status(200).send([]);
  } finally {
    client.release();
  }
});

interface CraftRequest {
  Body: {
    player_id: string;
    item_id: string;
    cost: number;
  };
}

fastify.post<CraftRequest>('/player/craft', async (request, reply) => {
  const { player_id, item_id, cost } = request.body;
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    
    const resQuery = await client.query(`
      SELECT quantity FROM resources WHERE player_id = $1 AND name = 'Fragments de Code' FOR UPDATE
    `, [player_id]);
    
    if (resQuery.rows.length === 0 || resQuery.rows[0].quantity < cost) {
      await client.query('ROLLBACK');
      return reply.status(400).send({ error: "Fragments insuffisants." });
    }
    
    await client.query('UPDATE resources SET quantity = quantity - $2 WHERE player_id = $1 AND name = $3', [player_id, cost, 'Fragments de Code']);
    
    await client.query(`
      INSERT INTO player_items (player_id, item_id, quantity)
      VALUES ($1, $2, 1)
      ON CONFLICT (player_id, item_id)
      DO UPDATE SET quantity = player_items.quantity + 1
    `, [player_id, item_id]);
    
    await client.query('COMMIT');
    return reply.status(200).send({ message: `Craft réussi : ${item_id}.` });
  } catch (error) {
    await client.query('ROLLBACK');
    fastify.log.error(error);
    return reply.status(500).send({ error: "Erreur lors du craft." });
  } finally {
    client.release();
  }
});

interface UseItemRequest {
  Body: {
    player_id: string;
    item_id: string;
  };
}

fastify.post<UseItemRequest>('/player/use-item', async (request, reply) => {
  const { player_id, item_id } = request.body;
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    
    const resQuery = await client.query(`
      SELECT quantity FROM player_items WHERE player_id = $1 AND item_id = $2 FOR UPDATE
    `, [player_id, item_id]);
    
    if (resQuery.rows.length === 0 || resQuery.rows[0].quantity <= 0) {
      await client.query('ROLLBACK');
      return reply.status(400).send({ error: "Item introuvable ou épuisé." });
    }
    
    await client.query('UPDATE player_items SET quantity = quantity - 1 WHERE player_id = $1 AND item_id = $2', [player_id, item_id]);
    await client.query('UPDATE players SET active_exploit = $2 WHERE id = $1', [player_id, item_id]);
    
    await client.query('COMMIT');
    return reply.status(200).send({ message: `Exploit activé : ${item_id}.` });
  } catch (error) {
    await client.query('ROLLBACK');
    fastify.log.error(error);
    return reply.status(500).send({ error: "Erreur lors de l'activation." });
  } finally {
    client.release();
  }
});

fastify.get<PlayerParams>('/player/items/:id', async (request, reply) => {
  const { id } = request.params;
  const client = await dbPool.connect();
  try {
    const result = await client.query('SELECT item_id, quantity FROM player_items WHERE player_id = $1 AND quantity > 0', [id]);
    return reply.status(200).send(result.rows);
  } catch (error) {
    fastify.log.error(error);
    return reply.status(200).send([]);
  } finally {
    client.release();
  }
});

// Route GET /leaderboard
fastify.get('/leaderboard', async (request, reply) => {
  const client = await dbPool.connect();
  try {
    const result = await client.query("SELECT username, credits, level FROM players WHERE LENGTH(id) > 10 AND id NOT LIKE 'bot-%' ORDER BY credits DESC LIMIT 5");
    return reply.status(200).send(result.rows);
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: "Erreur lors de la récupération du leaderboard." });
  } finally {
    client.release();
  }
});

// Route GET /actions/recent pour le Dashboard Global Feed
fastify.get('/actions/recent', async (request, reply) => {
  const client = await dbPool.connect();

  try {
    const result = await client.query(`
      SELECT va.id, va.status, va.created_at, va.target_server_id as server_name, p.username 
      FROM virus_actions va 
      LEFT JOIN players p ON va.player_id = p.id 
      ORDER BY va.created_at DESC 
      LIMIT 15
    `);
    return reply.status(200).send(result.rows);
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: "Erreur lors de la récupération des actions globales." });
  } finally {
    client.release();
  }
});

// Route POST /session/reset pour réinitialiser la partie
fastify.post('/session/reset', async (request, reply) => {
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');
    await client.query('UPDATE players SET credits = 5000');
    await client.query('UPDATE target_servers SET security_level = 10');
    await client.query('COMMIT');
    
    fastify.log.info("Session système rebootée.");
    return reply.status(200).send({ message: "Session réinitialisée avec succès." });
  } catch (error) {
    await client.query('ROLLBACK');
    fastify.log.error(error);
    return reply.status(500).send({ error: "Erreur lors du reboot système." });
  } finally {
    client.release();
  }
});

// Démarrage du serveur
const start = async () => {
  try {
    const client = await dbPool.connect();
    fastify.log.info("[DB] Connexion à la base de données PostgreSQL réussie.");
    client.release();

    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    fastify.log.info(`API Gateway active sur le port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
