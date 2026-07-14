const { db, initializeDatabase } = require('./src/database');
const { PRODUCTS } = require('./src/simulator');

console.log("🌱 Génération de l'historique sur 7 jours pour les courbes IA...");

// S'assurer que les tables sont créées
initializeDatabase();

// Nettoyer la base de données (l'ordre est important pour les Foreign Keys)
db.exec('DELETE FROM anomalies');
db.exec('DELETE FROM pump_health');
db.exec('DELETE FROM dosages');

const customInsert = db.prepare(`
  INSERT INTO dosages (product_id, product_name, target_volume, actual_volume, duration_seconds, is_anomaly, anomaly_type, timestamp)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

// Générer des événements parfaits sur les 7 derniers jours pour CHAQUE produit
const now = Date.now();
const msPerDay = 86_400_000;

// On va créer 1 point par jour et par produit, de -7 jours à aujourd'hui
for (let dayOffset = 7; dayOffset >= 0; dayOffset--) {
  const timestamp = now - (dayOffset * msPerDay);
  const timeProgress = (7 - dayOffset) / 7; // 0 (il y a 7 jours) à 1 (aujourd'hui)

  for (const product of PRODUCTS) {
    // Utiliser la cible nominale comme volume cible
    // Note: product.targetRange est défini dans simulator.js, on prend le milieu
    const target = (product.targetRange[0] + product.targetRange[1]) / 2;
    
    // Un flowRate estimé de 1.2 L/sec
    const baseDuration = target / 1.2;
    
    // Chaque produit s'use un peu différemment (usure ajoutée entre 3 et 8 secondes au total)
    const wearFactor = 3 + (product.id % 5); 
    const addedWear = timeProgress * wearFactor;
    
    // Ajouter un tout petit peu de bruit aléatoire (±0.5s) pour faire réaliste, mais la tendance reste forte
    const noise = (Math.random() - 0.5) * 1.0;
    
    const duration = baseDuration + addedWear + noise;
    
    // Volume actuel parfait
    const actualVolume = target;

    const timestampStr = new Date(timestamp).toISOString();

    customInsert.run(
      product.id,
      product.name,
      target,
      actualVolume,
      duration,
      0,
      null, // isAnomaly, anomalyType
      timestampStr
    );
  }
}

console.log("✅ Données parfaites générées pour les courbes d'usure !");
