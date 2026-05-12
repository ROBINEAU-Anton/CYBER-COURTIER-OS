import { Pool } from 'pg';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const dbPool = new Pool({ connectionString: DATABASE_URL });
const redis = new Redis(REDIS_URL);

console.log("Sim-Engine démarré. Connexion à PostgreSQL et Redis établie.");

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function simulateAction() {
  const client = await dbPool.connect();
  try {
    // Sélectionner un bot aléatoire
    const botResult = await client.query(`SELECT id FROM players WHERE id LIKE 'bot_%' ORDER BY RANDOM() LIMIT 1`);
    if (botResult.rows.length === 0) {
      console.log("Aucun bot disponible pour la simulation.");
      return;
    }
    const botId = botResult.rows[0].id;

    // Sélectionner un packet aléatoire
    const packetResult = await client.query(`SELECT id, target_server_id FROM data_packets ORDER BY RANDOM() LIMIT 1`);
    if (packetResult.rows.length === 0) {
      console.log("Aucun packet disponible pour la simulation.");
      return;
    }
    const packetId = packetResult.rows[0].id;
    const targetServerId = packetResult.rows[0].target_server_id;

    await client.query('BEGIN');

    // Vérifier les crédits
    const creditsResult = await client.query('SELECT credits FROM players WHERE id = $1 FOR UPDATE', [botId]);
    if (creditsResult.rows.length === 0 || creditsResult.rows[0].credits < 1000) {
      await client.query('ROLLBACK');
      console.log(`Bot ${botId} n'a pas assez de crédits.`);
      return;
    }

    // Déduire les crédits
    await client.query('UPDATE players SET credits = credits - 1000 WHERE id = $1', [botId]);
    
    // LPUSH dans actions_queue et insertion dans virus_actions
    const actionId = uuidv4();
    await client.query(
      `INSERT INTO virus_actions (id, player_id, target_server_id, packet_id, status) VALUES ($1, $2, $3, $4, 'PENDING')`,
      [actionId, botId, targetServerId, packetId]
    );

    await client.query('COMMIT');

    const actionPayload = {
      ID: actionId,
      PlayerID: botId,
      TargetServerID: targetServerId,
      PacketID: packetId
    };

    await redis.lpush('actions_queue', JSON.stringify(actionPayload));
    console.log(`[SIM] Bot ${botId} a attaqué avec le packet ${packetId}. Action ID: ${actionId}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Erreur durant la simulation:", error);
  } finally {
    client.release();
  }
}

async function loop() {
  while (true) {
    const delay = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;
    await sleep(delay);
    await simulateAction();
  }
}

loop();
