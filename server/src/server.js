/**
 * ============================================================
 *  SARTEX FlowMaster — Serveur Principal (Node.js)
 * ============================================================
 *  Ce fichier est le cœur du backend. Il orchestre :
 *  - L'API REST (Express) pour l'historique et les stats
 *  - Le serveur WebSocket (Socket.io) pour le temps réel
 *  - Le simulateur de dosage (ou le client Modbus réel)
 *  - L'IA pour l'analyse en temps réel
 * ============================================================
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { initializeDatabase, clearAllData, restoreDatabase, queries } = require('./database');
const { DosageSimulator, PRODUCTS } = require('./simulator');
const { AIEngine } = require('./aiEngine');
const { ModbusClient } = require('./modbusClient');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // En production, restreindre à l'URL du frontend
    methods: ['GET', 'POST']
  }
});

// Initialiser la base de données
initializeDatabase();

// Initialiser l'IA
const ai = new AIEngine(queries);

// Initialiser le Simulateur (Par défaut en mode simulation)
const simulator = new DosageSimulator();

// Client Modbus (sera connecté uniquement en mode réel)
let modbusClient = null;

// ==========================================
//  WEBSOCKET (Temps Réel)
// ==========================================
io.on('connection', (socket) => {
  console.log(`🔌 Nouveau client connecté : ${socket.id}`);

  // Envoyer la configuration des produits au client dès la connexion
  socket.emit('config:products', PRODUCTS);

  socket.on('disconnect', () => {
    console.log(`🔌 Client déconnecté : ${socket.id}`);
  });
});

// Écouter les événements du simulateur (ou Modbus) et les relayer via WebSocket
const setupListeners = (source) => {
  source.on('dosage:start', (data) => io.emit('dosage:start', data));
  source.on('dosage:update', (updates) => io.emit('dosage:update', updates));
  source.on('products:state', (states) => io.emit('products:state', states));
  source.on('dosage:complete', handleDosageComplete);
};

const handleDosageComplete = (data) => {
  // 1. Détecter les anomalies via l'IA
  const anomaly = ai.detectAnomaly(data.productId, data.actualVolume);
  
  const isAnomaly = anomaly ? 1 : 0;
  const anomalyType = anomaly ? anomaly.anomalyType : null;

  // 2. Enregistrer le dosage dans SQLite
  const result = queries.insertDosage.run(
    data.productId,
    data.productName,
    data.targetVolume,
    data.actualVolume,
    data.durationSeconds,
    isAnomaly,
    anomalyType
  );

  const dosageId = result.lastInsertRowid;

  // 3. Enregistrer l'anomalie si elle existe
  if (anomaly) {
    queries.insertAnomaly.run(
      dosageId,
      data.productName,
      anomaly.anomalyType,
      anomaly.severity,
      anomaly.zScore,
      anomaly.expectedValue,
      anomaly.actualValue,
      anomaly.message
    );
    // Notifier le frontend immédiatement
    io.emit('alert:anomaly', anomaly);
  }

  // 4. Mettre à jour la santé de la pompe (Maintenance prédictive)
  const health = ai.predictMaintenance(data.productId);
  queries.insertPumpHealth.run(
    data.productId,
    data.productName,
    health.healthScore,
    health.avgDuration,
    health.trendSlope,
    health.predictedFailureDays
  );

  // 5. Notifier le frontend que le dosage est terminé et sauvegardé
  io.emit('dosage:complete', { ...data, id: dosageId, isAnomaly, healthScore: health.healthScore });
};

setupListeners(simulator);


// ==========================================
//  API REST (Historique & IA)
// ==========================================

// Obtenir tout l'historique (avec limite)
app.get('/api/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  try {
    const history = queries.getRecentDosages.all(limit);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir l'historique d'un produit spécifique
app.get('/api/history/:productId', (req, res) => {
  const productId = parseInt(req.params.productId);
  const limit = parseInt(req.query.limit) || 50;
  try {
    const history = queries.getDosagesByProduct.all(productId, limit);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir l'analyse complète IA (Dashboard IA)
app.get('/api/ai/analysis', (req, res) => {
  try {
    const analysis = ai.generateFullAnalysis();
    // Ajouter les dernières anomalies non acquittées
    analysis.recentAnomalies = queries.getRecentAnomalies.all(10);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Contrôler le mode de fonctionnement (Simulation ou Live PLC)
app.post('/api/mode/:mode', async (req, res) => {
  const { mode } = req.params;
  
  if (mode === 'live' || mode === 'real') {
    simulator.stop();
    
    if (!modbusClient) {
      const modeConnexion = process.env.CONNECTION_MODE || "RTU";
      const portSerie = process.env.PORT_SERIE || "COM3";
      const baudRate = parseInt(process.env.BAUD_RATE || "9600", 10);
      const useTCP = modeConnexion === "TCP";
      const hmiIp = process.env.HMI_IP || "192.168.1.50";
      const modbusPort = parseInt(process.env.MODBUS_PORT || "502", 10);

      modbusClient = new ModbusClient(portSerie, baudRate, useTCP, hmiIp, modbusPort);
      setupListeners(modbusClient);
    }
    
    const success = await modbusClient.connect();
    if (success) {
      res.json({ status: 'live_plc', message: 'Connecté au PLC Delta DVP' });
    } else {
      res.status(500).json({ error: 'Impossible de se connecter au PLC' });
    }
  } 
  else if (mode === 'simulation') {
    if (modbusClient) {
      modbusClient.stop();
    }
    simulator.start();
    res.json({ status: 'simulation', message: 'Simulateur redémarré' });
  } 
  else {
    res.status(400).json({ error: 'Mode invalide' });
  }
});


// ==========================================
//  API ADMIN (Reset, Restore, Consignes)
// ==========================================

// Réinitialiser la base de données (sauvegarde automatique avant)
app.post('/api/admin/reset', (req, res) => {
  try {
    clearAllData();
    simulator.resetCounters();
    ai.resetBuffers && ai.resetBuffers();
    // Notifier tous les clients WebSocket de recharger leurs données
    io.emit('admin:reset');
    console.log('🔄 RESET DÉMO effectué avec succès');
    res.json({ status: 'reset_complete', message: 'Base vidée, backup conservé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restaurer la dernière sauvegarde
app.post('/api/admin/restore', (req, res) => {
  try {
    const success = restoreDatabase();
    if (success) {
      io.emit('admin:reset'); // Forcer le rechargement côté client
      res.json({ status: 'restore_complete', message: 'Données restaurées depuis le backup' });
    } else {
      res.status(404).json({ error: 'Aucun backup trouvé' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir les consignes actuelles
app.get('/api/admin/targets', (req, res) => {
  try {
    const targets = simulator.getTargets();
    res.json(targets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mettre à jour la consigne d'un produit (simulation + PLC live)
app.post('/api/admin/targets', (req, res) => {
  const { productId, target } = req.body;
  if (!productId || !target || target <= 0) {
    return res.status(400).json({ error: 'productId et target (> 0) requis' });
  }
  try {
    // 1. Mettre à jour le simulateur
    const simOk = simulator.updateTarget(productId, target);
    
    // 2. Si le client Modbus est connecté, écrire aussi dans le PLC
    let plcOk = false;
    if (modbusClient && modbusClient.isConnected) {
      modbusClient.writeTarget(productId, target).then(ok => {
        if (ok) console.log(`✅ Consigne PLC Live synchronisée pour produit ${productId}`);
      }).catch(err => console.error('Erreur PLC:', err));
      plcOk = true;
    }
    
    // Notifier le frontend
    io.emit('admin:targetUpdated', { productId, target });
    
    res.json({ 
      status: 'ok', 
      simulator: simOk, 
      plcWritten: plcOk,
      message: `Consigne produit ${productId} → ${target} L` 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ==========================================
//  DÉMARRAGE DU SERVEUR
// ==========================================
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Serveur SARTEX FlowMaster démarré sur le port ${PORT}`);
  // Démarrer le simulateur par défaut pour voir des données tout de suite
  simulator.start();
});
