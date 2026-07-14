/**
 * ============================================================
 *  SARTEX FlowMaster — Module Base de Données (SQLite)
 * ============================================================
 *  Ce fichier crée et gère la base de données locale SQLite.
 *  SQLite est le choix idéal pour l'Edge Computing industriel :
 *    - Aucun serveur externe requis
 *    - Un seul fichier .db portable
 *    - Performances suffisantes pour des millions de lignes
 * ============================================================
 */

const Database = require('better-sqlite3');
const path = require('path');

// Chemin vers le fichier de base de données
const DB_PATH = path.join(__dirname, '..', 'data', 'dosages.db');

// Création du dossier data s'il n'existe pas
const fs = require('fs');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Connexion à la base de données
const db = new Database(DB_PATH);

// Activer le mode WAL pour de meilleures performances en écriture concurrente
db.pragma('journal_mode = WAL');

/**
 * Initialisation du schéma de la base de données
 * On crée les tables si elles n'existent pas encore
 */
function initializeDatabase() {
  // -------------------------------------------------------
  // Table principale : dosages
  // Chaque ligne = un dosage terminé d'un produit
  // -------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS dosages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      target_volume REAL NOT NULL,
      actual_volume REAL NOT NULL,
      duration_seconds REAL,
      is_anomaly INTEGER DEFAULT 0,
      anomaly_type TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // -------------------------------------------------------
  // Table : anomalies
  // Historique des anomalies détectées par l'IA
  // -------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS anomalies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      dosage_id INTEGER,
      product_name TEXT NOT NULL,
      anomaly_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'warning',
      z_score REAL,
      expected_value REAL,
      actual_value REAL,
      message TEXT,
      acknowledged INTEGER DEFAULT 0,
      FOREIGN KEY (dosage_id) REFERENCES dosages(id)
    )
  `);

  // -------------------------------------------------------
  // Table : pump_health
  // Suivi de la santé des pompes (maintenance prédictive)
  // -------------------------------------------------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS pump_health (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      health_score REAL NOT NULL,
      avg_duration REAL,
      trend_slope REAL,
      predicted_failure_days INTEGER
    )
  `);

  // Index pour accélérer les requêtes fréquentes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dosages_timestamp ON dosages(timestamp);
    CREATE INDEX IF NOT EXISTS idx_dosages_product ON dosages(product_id);
    CREATE INDEX IF NOT EXISTS idx_anomalies_timestamp ON anomalies(timestamp);
  `);

  console.log('✅ Base de données SQLite initialisée avec succès');
}

/**
 * Sauvegarde la base de données avant un reset
 * Copie le fichier .db vers dosages_backup.db
 */
function backupDatabase() {
  const backupPath = path.join(dataDir, 'dosages_backup.db');
  try {
    // Forcer SQLite à écrire les données WAL dans le fichier principal
    db.pragma('wal_checkpoint(TRUNCATE)');
    fs.copyFileSync(DB_PATH, backupPath);
    console.log('💾 Backup créé : dosages_backup.db');
    return true;
  } catch (e) {
    console.error('❌ Erreur backup:', e.message);
    return false;
  }
}

/**
 * Restaure la base de données depuis la dernière sauvegarde
 */
function restoreDatabase() {
  const backupPath = path.join(dataDir, 'dosages_backup.db');
  if (!fs.existsSync(backupPath)) {
    console.error('❌ Aucun backup trouvé');
    return false;
  }
  try {
    // Supprimer les données actuelles
    db.exec('DELETE FROM dosages; DELETE FROM anomalies; DELETE FROM pump_health;');
    // Charger le backup dans une base temporaire et copier les données
    const backupDb = new Database(backupPath, { readonly: true });
    const dosages = backupDb.prepare('SELECT * FROM dosages').all();
    const anomalies = backupDb.prepare('SELECT * FROM anomalies').all();
    const pumpHealth = backupDb.prepare('SELECT * FROM pump_health').all();
    backupDb.close();

    // Réinsérer les données
    const insertMany = db.transaction(() => {
      for (const row of dosages) {
        db.prepare('INSERT INTO dosages (id, timestamp, product_id, product_name, target_volume, actual_volume, duration_seconds, is_anomaly, anomaly_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
          row.id, row.timestamp, row.product_id, row.product_name, row.target_volume, row.actual_volume, row.duration_seconds, row.is_anomaly, row.anomaly_type, row.created_at
        );
      }
      for (const row of anomalies) {
        db.prepare('INSERT INTO anomalies (id, timestamp, dosage_id, product_name, anomaly_type, severity, z_score, expected_value, actual_value, message, acknowledged) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
          row.id, row.timestamp, row.dosage_id, row.product_name, row.anomaly_type, row.severity, row.z_score, row.expected_value, row.actual_value, row.message, row.acknowledged
        );
      }
      for (const row of pumpHealth) {
        db.prepare('INSERT INTO pump_health (id, timestamp, product_id, product_name, health_score, avg_duration, trend_slope, predicted_failure_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
          row.id, row.timestamp, row.product_id, row.product_name, row.health_score, row.avg_duration, row.trend_slope, row.predicted_failure_days
        );
      }
    });
    insertMany();
    console.log(`✅ Restauration terminée : ${dosages.length} dosages, ${anomalies.length} anomalies`);
    return true;
  } catch (e) {
    console.error('❌ Erreur restauration:', e.message);
    return false;
  }
}

/**
 * Vide toutes les tables (après backup automatique)
 */
function clearAllData() {
  backupDatabase();
  db.exec('DELETE FROM dosages; DELETE FROM anomalies; DELETE FROM pump_health;');
  console.log('🗑️  Base de données vidée (backup conservé)');
}

// Initialiser immédiatement pour pouvoir préparer les requêtes ensuite
initializeDatabase();

// =============================================
//  Requêtes préparées (Prepared Statements)
//  Plus rapides et protégées contre l'injection SQL
// =============================================

const insertDosage = db.prepare(`
  INSERT INTO dosages (product_id, product_name, target_volume, actual_volume, duration_seconds, is_anomaly, anomaly_type)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertAnomaly = db.prepare(`
  INSERT INTO anomalies (dosage_id, product_name, anomaly_type, severity, z_score, expected_value, actual_value, message)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertPumpHealth = db.prepare(`
  INSERT INTO pump_health (product_id, product_name, health_score, avg_duration, trend_slope, predicted_failure_days)
  VALUES (?, ?, ?, ?, ?, ?)
`);

// Récupérer les N derniers dosages
const getRecentDosages = db.prepare(`
  SELECT * FROM dosages ORDER BY timestamp DESC LIMIT ?
`);

// Récupérer les dosages d'un produit spécifique
const getDosagesByProduct = db.prepare(`
  SELECT * FROM dosages WHERE product_id = ? ORDER BY timestamp DESC LIMIT ?
`);

// Récupérer les dosages pour les calculs IA (les 50 derniers par produit)
const getDosagesForAI = db.prepare(`
  SELECT * FROM dosages WHERE product_id = ? ORDER BY timestamp DESC LIMIT 50
`);

// Récupérer les anomalies récentes
const getRecentAnomalies = db.prepare(`
  SELECT * FROM anomalies ORDER BY timestamp DESC LIMIT ?
`);

// Statistiques globales
const getStats = db.prepare(`
  SELECT 
    COUNT(*) as total_dosages,
    COUNT(CASE WHEN is_anomaly = 1 THEN 1 END) as total_anomalies,
    AVG(actual_volume) as avg_volume,
    MIN(timestamp) as first_dosage,
    MAX(timestamp) as last_dosage
  FROM dosages
`);

// Statistiques par produit
const getStatsByProduct = db.prepare(`
  SELECT 
    product_id,
    product_name,
    COUNT(*) as total_dosages,
    AVG(actual_volume) as avg_volume,
    MIN(actual_volume) as min_volume,
    MAX(actual_volume) as max_volume,
    AVG(duration_seconds) as avg_duration,
    COUNT(CASE WHEN is_anomaly = 1 THEN 1 END) as anomaly_count
  FROM dosages
  GROUP BY product_id
  ORDER BY product_id
`);

// Dernière santé de chaque pompe
const getLatestPumpHealth = db.prepare(`
  SELECT ph.* FROM pump_health ph
  INNER JOIN (
    SELECT product_id, MAX(id) as max_id
    FROM pump_health
    GROUP BY product_id
  ) latest ON ph.id = latest.max_id
  ORDER BY ph.product_id
`);

module.exports = {
  db,
  initializeDatabase,
  backupDatabase,
  restoreDatabase,
  clearAllData,
  queries: {
    insertDosage,
    insertAnomaly,
    insertPumpHealth,
    getRecentDosages,
    getDosagesByProduct,
    getDosagesForAI,
    getRecentAnomalies,
    getStats,
    getStatsByProduct,
    getLatestPumpHealth
  }
};
