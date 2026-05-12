import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

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
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
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
      SELECT dp.target_server_id, ts.security_level 
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
    const injectionCost = securityLevel * 100;

    // 2. Vérification du joueur (avec FOR UPDATE pour verrouiller la ligne)
    const playerResult = await client.query('SELECT credits FROM players WHERE id = $1 FOR UPDATE', [player_id]);
    
    if (playerResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return reply.status(400).send({ error: "Connexion neuronale refusée : identifiant runner inconnu." });
    }

    const credits = playerResult.rows[0].credits;
    if (credits < injectionCost) {
      await client.query('ROLLBACK');
      return reply.status(400).send({ error: `Fonds insuffisants. Coût de l'injection : ${injectionCost} ¤.` });
    }

    // 3. Débit des crédits
    await client.query('UPDATE players SET credits = credits - $2 WHERE id = $1', [player_id, injectionCost]);

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
    const result = await client.query('SELECT username, credits FROM players WHERE id = $1', [id]);
    
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

// Route GET /servers pour le Dashboard
fastify.get('/servers', async (request, reply) => {
  const client = await dbPool.connect();

  try {
    const result = await client.query('SELECT id, name, security_level FROM target_servers ORDER BY name ASC');
    return reply.status(200).send(result.rows);
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: "Erreur lors du balayage du réseau." });
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
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    fastify.log.info(`API Gateway active sur le port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
