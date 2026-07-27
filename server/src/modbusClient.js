/**
 * ============================================================
 *  SARTEX FlowMaster — Client Modbus RTU (Mode Usine)
 * ============================================================
 *  Ce module remplace le simulateur lorsqu'on branche le PC
 *  à l'automate Delta DVP via un câble USB-RS485 ou via
 *  le module DVPEN01 (Modbus TCP).
 *
 *  Adresses PLC ISPSoft :
 *  ─────────────────────────────────────────────────────────
 *  B_MARCHE_P1..P8 : X2,X6,X0,X14,X16,X12,X10,X4 (Boutons)
 *  POMPE1..8       : Y0..Y7   (Sorties pompes)
 *  ELV1..8         : Y10..Y17 (Sorties électrovannes)
 *  DOSE_P1..P8     : D10,D20..D80 (Consignes, REAL 32-bit)
 *  dose (mesure)   : D102,D112..D172 (Volumes mesurés, REAL)
 *  DOSE_VALIDE     : M100,M200..M800 (Flags fin de dosage)
 *  NB1..NB8        : M3000..M3007 (Niveaux bas cuves)
 *  ─────────────────────────────────────────────────────────
 *
 *  Adresses Modbus pour Delta DVP :
 *    Registre D[n] → Holding Register address = 4000 + n
 *    Marqueur M[n] → Coil address = 2000 + n
 *    Entrée X[n]   → Discrete Input (lecture seule)
 *    Sortie Y[n]   → Coil (lecture)
 * ============================================================
 */

let ModbusRTU;
try {
  ModbusRTU = require("modbus-serial");
} catch (e) {
  console.warn("⚠️ Module 'modbus-serial' non installé. Le mode PLC Live ne fonctionnera pas.");
  console.warn("   Pour l'installer : npm install modbus-serial");
}

const EventEmitter = require('events');

/**
 * Configuration des 8 produits avec toutes les adresses ISPSoft
 */
const PLC_PRODUCTS = [
  { id: 1, name: 'CHTT-AB35',  marcheAddr: 'X2',  stopAddr: 'X3',  pompeAddr: 'Y0',  elvAddr: 'Y10', consigneReg: 10,  doseReg: 102, flagBit: 100, nbBit: 3000 },
  { id: 2, name: 'FST RW',     marcheAddr: 'X6',  stopAddr: 'X7',  pompeAddr: 'Y1',  elvAddr: 'Y11', consigneReg: 20,  doseReg: 112, flagBit: 200, nbBit: 3001 },
  { id: 3, name: 'JAVEL',      marcheAddr: 'X0',  stopAddr: 'X1',  pompeAddr: 'Y2',  elvAddr: 'Y12', consigneReg: 30,  doseReg: 122, flagBit: 300, nbBit: 3002 },
  { id: 4, name: 'VESASITAM',  marcheAddr: 'X14', stopAddr: 'X15', pompeAddr: 'Y3',  elvAddr: 'Y13', consigneReg: 40,  doseReg: 132, flagBit: 400, nbBit: 3003 },
  { id: 5, name: 'KAYA',       marcheAddr: 'X16', stopAddr: 'X17', pompeAddr: 'Y4',  elvAddr: 'Y14', consigneReg: 50,  doseReg: 142, flagBit: 500, nbBit: 3004 },
  { id: 6, name: 'Hidrofil',   marcheAddr: 'X12', stopAddr: 'X13', pompeAddr: 'Y5',  elvAddr: 'Y15', consigneReg: 60,  doseReg: 152, flagBit: 600, nbBit: 3005 },
  { id: 7, name: 'SERTENZIN',  marcheAddr: 'X10', stopAddr: 'X11', pompeAddr: 'Y6',  elvAddr: 'Y16', consigneReg: 70,  doseReg: 162, flagBit: 700, nbBit: 3006 },
  { id: 8, name: 'DENIMCOL',   marcheAddr: 'X4',  stopAddr: 'X5',  pompeAddr: 'Y7',  elvAddr: 'Y17', consigneReg: 80,  doseReg: 172, flagBit: 800, nbBit: 3007 }
];

class ModbusClient extends EventEmitter {
  constructor(port = "COM3", baudRate = 9600, useTCP = false, tcpHost = "192.168.1.1", tcpPort = 502) {
    super();
    this.port = port;
    this.baudRate = baudRate;
    this.useTCP = useTCP;
    this.tcpHost = tcpHost;
    this.tcpPort = tcpPort;
    this.isConnected = false;
    this.pollingInterval = null;
    this.products = PLC_PRODUCTS;
    this.client = null;

    // État précédent pour détecter les fronts montants (rising edge)
    this.previousFlags = {};
    this.previousVolumes = {};
    this.dosageStartTimes = {};
    this.simulatedVolumes = {};
    PLC_PRODUCTS.forEach(p => {
      this.previousFlags[p.id] = false;
      this.previousVolumes[p.id] = 0;
      this.dosageStartTimes[p.id] = null;
      this.simulatedVolumes[p.id] = 0;
    });
  }

  /**
   * Connexion au PLC (RTU série ou TCP Ethernet)
   */
  async connect() {
    if (!ModbusRTU) {
      console.error("❌ Module 'modbus-serial' non disponible. Installez-le avec : npm install modbus-serial");
      return false;
    }

    this.client = new ModbusRTU();

    try {
      if (this.useTCP) {
        console.log(`🔌 Connexion Modbus TCP vers ${this.tcpHost}:${this.tcpPort}...`);
        await this.client.connectTCP(this.tcpHost, { port: this.tcpPort });
      } else {
        console.log(`🔌 Connexion Modbus RTU sur ${this.port} à ${this.baudRate} bauds...`);
        await this.client.connectRTUBuffered(this.port, { baudRate: this.baudRate });
      }

      this.client.setID(1); // Station ID du PLC Delta DVP
      this.client.setTimeout(2000);
      this.isConnected = true;
      console.log("✅ Connecté à l'automate Delta DVP via Modbus");
      this.startPolling();
      return true;
    } catch (e) {
      console.error("❌ Échec de la connexion Modbus:", e.message);
      if (!this.useTCP) {
        console.log("💡 Vérifiez que le câble USB-RS485 est branché et le port COM correct.");
        console.log("   Ports disponibles : utilisez 'mode' dans CMD pour voir les ports COM.");
      } else {
        console.log("💡 Vérifiez que le module DVPEN01 est configuré et accessible sur le réseau.");
      }
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Démarre le polling des registres PLC (toutes les 500ms)
   */
  startPolling() {
    if (!this.isConnected) return;
    console.log("📡 Début du polling PLC toutes les 500ms...");

    this.pollingInterval = setInterval(async () => {
      try {
        await this.readPLC();
      } catch (e) {
        console.error("⚠️ Erreur de lecture Modbus:", e.message);
        // Si trop d'erreurs, on déconnecte
        if (e.message.includes('Port Not Open') || e.message.includes('Timed out')) {
          console.error("❌ Connexion PLC perdue. Arrêt du polling.");
          this.stop();
        }
      }
    }, 500);
  }

  /**
   * Arrête la connexion et le polling
   */
  stop() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.pollingInterval = null;
    if (this.client && this.isConnected) {
      try { this.client.close(); } catch (e) { /* ignore */ }
    }
    this.isConnected = false;
    console.log("⏹️ Connexion Modbus fermée");
  }

  /**
   * Convertit 2 registres 16-bit en float 32-bit (REAL)
   * Delta DVP stocke les REAL en Little-Endian (Low word first)
   */
  _registersToFloat(lowWord, highWord) {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt16LE(lowWord, 0);
    buffer.writeUInt16LE(highWord, 2);
    return buffer.readFloatLE(0);
  }

  /**
   * Lecture principale du PLC — appelée toutes les 500ms
   * 
   * Lit les registres D (volumes, consignes) et les coils M (flags)
   * Détecte les fronts montants sur M100-M800 pour savoir quand
   * un dosage est terminé.
   */
  async readPLC() {
    if (!this.client || !this.isConnected) return;

    // ──────────────────────────────────────────────
    // 1. Lire les flags de fin de dosage (M100-M800)
    //    Adresse Modbus coil pour M0 = 2048 (0x0800)
    // ──────────────────────────────────────────────
    const flagResults = {};
    for (const p of this.products) {
      try {
        const coilAddr = 2048 + p.flagBit;
        const result = await this.client.readCoils(coilAddr, 1);
        flagResults[p.id] = result.data[0];
      } catch (e) {
        flagResults[p.id] = this.previousFlags[p.id]; // Garder l'état précédent
      }
    }

    // ──────────────────────────────────────────────
    // 2. Lire les volumes mesurés (D102, D112..D172)
    //    REAL = 2 registres (32-bit float)
    //    Adresse Modbus pour D0 = 4096 (0x1000)
    // ──────────────────────────────────────────────
    const volumes = {};
    for (const p of this.products) {
      try {
        const regAddr = 4096 + p.doseReg;
        const result = await this.client.readHoldingRegisters(regAddr, 2);
        volumes[p.id] = this._registersToFloat(result.data[0], result.data[1]);
      } catch (e) {
        volumes[p.id] = this.previousVolumes[p.id];
      }
    }

    // ──────────────────────────────────────────────
    // 3. Lire les consignes (D10, D20..D80)
    // ──────────────────────────────────────────────
    const consignes = {};
    for (const p of this.products) {
      try {
        const regAddr = 4096 + p.consigneReg;
        const result = await this.client.readHoldingRegisters(regAddr, 2);
        consignes[p.id] = this._registersToFloat(result.data[0], result.data[1]);
      } catch (e) {
        consignes[p.id] = 0;
      }
    }

    // ──────────────────────────────────────────────
    // 4. Construire l'état de chaque produit
    // ──────────────────────────────────────────────
    const productStates = [];
    
    for (const p of this.products) {
      const targetVolume = consignes[p.id] || 0;
      const flagDone = flagResults[p.id] || false;
      const prevFlag = this.previousFlags[p.id] || false;

      // Option A: Simulation visuelle sans débitmètre
      // On suppose que si la consigne est > 0 et que le dosage n'est pas terminé,
      // la pompe tourne (ou va tourner).
      const isDosing = targetVolume > 0 && !flagDone;

      if (isDosing) {
        // Incrémentation théorique pour l'animation (ex: 0.5L par 500ms = 1L/s)
        // On bloque à 99% en attendant le vrai flag de fin de l'automate
        this.simulatedVolumes[p.id] = Math.min(this.simulatedVolumes[p.id] + 0.5, targetVolume * 0.99);
      } else {
        // Remise à zéro quand le dosage est terminé ou inactif
        this.simulatedVolumes[p.id] = flagDone ? targetVolume : 0;
      }

      const displayVolume = this.simulatedVolumes[p.id];

      // Tracker le début du dosage
      if (isDosing && !this.dosageStartTimes[p.id]) {
        this.dosageStartTimes[p.id] = Date.now();
        this.emit('dosage:start', {
          productId: p.id,
          productName: p.name,
          targetVolume: targetVolume,
          color: '#22d3ee' // Couleur par défaut
        });
      }

      // Calculer la progression pour l'interface
      const progress = targetVolume > 0 ? Math.min((displayVolume / targetVolume) * 100, 100) : 0;

      productStates.push({
        productId: p.id,
        productName: p.name,
        targetVolume: targetVolume,
        currentVolume: +displayVolume.toFixed(2),
        progress: +progress.toFixed(1),
        status: isDosing ? 'active' : (flagDone ? 'completed' : 'idle')
      });

      // ──────────────────────────────────────────
      // 5. FRONT MONTANT : M-bit passe de 0 → 1
      //    = Le dosage vient de se terminer !
      // ──────────────────────────────────────────
      if (flagDone && !prevFlag) {
        const startTime = this.dosageStartTimes[p.id] || Date.now();
        const durationSeconds = (Date.now() - startTime) / 1000;

        console.log(`✅ Dosage terminé : ${p.name} — ${targetVolume.toFixed(2)} L (consigne: ${targetVolume} L) en ${durationSeconds.toFixed(1)}s`);

        // Émettre l'événement dosage:complete
        // Le server.js va l'enregistrer dans SQLite + IA automatiquement
        this.emit('dosage:complete', {
          productId: p.id,
          productName: p.name,
          targetVolume: targetVolume,
          actualVolume: targetVolume, // <- CORRECTION : On utilise la consigne car pas de débitmètre !
          durationSeconds: +durationSeconds.toFixed(1),
          anomalyType: null // L'IA dans server.js détectera si c'est une anomalie
        });

        // Reset le tracker de début
        this.dosageStartTimes[p.id] = null;
      }

      // Mettre à jour l'état précédent
      this.previousFlags[p.id] = flagDone;
      this.previousVolumes[p.id] = currentVolume;
    }

    // Émettre l'état global des produits (pour les jauges du dashboard)
    this.emit('products:state', productStates);
  }

  /**
   * Écrit une consigne (volume cible) dans le registre D du PLC
   * Ex: writeTarget(1, 8.5) → écrit 8.5 dans D10 (CHTT-AB35)
   */
  async writeTarget(productId, targetVolume) {
    if (!this.client || !this.isConnected) {
      console.warn('⚠️ Modbus non connecté — consigne non écrite');
      return false;
    }

    const product = this.products.find(p => p.id === productId);
    if (!product) {
      console.error(`❌ Produit ID ${productId} non trouvé`);
      return false;
    }

    try {
      const regAddr = 4000 + product.consigneReg;

      // Convertir le float en 2 registres 16-bit (Little-Endian pour Delta DVP)
      const buffer = Buffer.alloc(4);
      buffer.writeFloatLE(targetVolume, 0);
      const lowWord = buffer.readUInt16LE(0);
      const highWord = buffer.readUInt16LE(2);

      await this.client.writeRegisters(regAddr, [lowWord, highWord]);
      console.log(`✅ Consigne PLC écrite : ${product.name} (D${product.consigneReg}) = ${targetVolume} L`);
      return true;
    } catch (e) {
      console.error(`❌ Erreur écriture Modbus D${product.consigneReg}:`, e.message);
      return false;
    }
  }

  /**
   * Retourne l'état actuel de la connexion et les dernières valeurs lues
   */
  getStatus() {
    return {
      connected: this.isConnected,
      mode: this.useTCP ? 'TCP' : 'RTU',
      port: this.useTCP ? `${this.tcpHost}:${this.tcpPort}` : this.port,
      products: this.products.map(p => ({
        id: p.id,
        name: p.name,
        volume: this.previousVolumes[p.id] || 0,
        flagDone: this.previousFlags[p.id] || false,
        isDosing: !!this.dosageStartTimes[p.id]
      }))
    };
  }
}

module.exports = { ModbusClient, PLC_PRODUCTS };
