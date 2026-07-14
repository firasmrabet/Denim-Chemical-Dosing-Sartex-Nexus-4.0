/**
 * ============================================================
 *  SARTEX FlowMaster — Client Modbus RTU (Mode Usine)
 * ============================================================
 *  Ce module est conçu pour remplacer le simulateur lorsqu'on
 *  branche le PC à l'automate Delta DVP via un câble USB-RS485.
 * 
 *  Il lit les registres D102 à D172 pour les volumes,
 *  et écoute les marqueurs M100 à M800 pour la fin du dosage.
 * ============================================================
 */

let ModbusRTU;
try {
  ModbusRTU = require("modbus-serial");
} catch (e) {
  console.warn("⚠️ Module 'modbus-serial' non installé. Le mode PLC Live ne fonctionnera pas.");
}

const EventEmitter = require('events');
const { PRODUCTS } = require('./simulator');

class ModbusClient extends EventEmitter {
  constructor(port = "COM3", baudRate = 9600) {
    super();
    this.client = new ModbusRTU();
    this.port = port;
    this.baudRate = baudRate;
    this.isConnected = false;
    this.pollingInterval = null;
    
    // État précédent pour détecter les changements (fronts montants)
    this.previousState = {};
    PRODUCTS.forEach(p => {
      this.previousState[p.id] = {
        isDosing: false,
        volume: 0,
        flag: false
      };
    });
  }

  async connect() {
    try {
      console.log(`🔌 Tentative de connexion Modbus sur ${this.port} à ${this.baudRate} bauds...`);
      await this.client.connectRTUBuffered(this.port, { baudRate: this.baudRate });
      this.client.setID(1);
      this.client.setTimeout(1000);
      this.isConnected = true;
      console.log("✅ Connecté à l'automate Delta via Modbus RTU");
      this.startPolling();
    } catch (e) {
      console.error("❌ Échec de la connexion Modbus:", e.message);
      console.log("💡 Astuce: Vérifiez que le câble USB-RS485 est bien branché sur le bon port COM.");
    }
  }

  startPolling() {
    if (!this.isConnected) return;
    
    // Lire les données toutes les 500ms
    this.pollingInterval = setInterval(async () => {
      try {
        await this.readPLC();
      } catch (e) {
        console.error("Erreur de lecture Modbus:", e.message);
      }
    }, 500);
  }

  stop() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    if (this.isConnected) this.client.close();
    this.isConnected = false;
    console.log("⏹️ Connexion Modbus fermée");
  }

  /**
   * Fonction principale : lit les registres D (Volumes) et M (Flags)
   * Note pour Delta DVP :
   * Les adresses Modbus exactes dépendent du modèle.
   * Généralement, D0 = 44097, M0 = 02049
   * (Ceci est un exemple générique à adapter avec le manuel Delta)
   */
  async readPLC() {
    // 1. Lire les registres de volume (Ex: D100 à D172)
    // Dans un vrai projet, on lirait un bloc contigu pour la performance
    // const dataD = await this.client.readHoldingRegisters(4100, 80); 
    
    // 2. Lire les flags de fin (Ex: M100 à M800)
    // const dataM = await this.client.readCoils(2100, 800);

    /* 
      Logique de traitement (identique au simulateur) :
      - Si un volume augmente -> on émet 'dosage:update'
      - Si un flag M (ex: M100) passe de 0 à 1 -> on émet 'dosage:complete'
    */

    // Exemple de structure de données émise :
    /*
    this.emit('dosage:update', [{
      productId: 1,
      currentVolume: 25.5,
      status: 'active'
    }]);

    this.emit('dosage:complete', {
      productId: 1,
      productName: 'CHTT-AB35',
      actualVolume: 42.1,
      targetVolume: 42.0,
      durationSeconds: 38.5
    });
    */
  }

  /**
   * Écrit une nouvelle consigne (volume cible) dans le registre D de l'automate
   * Les registres de consigne pour le Delta DVP :
   *   Produit 1 (CHTT-AB35) : D10
   *   Produit 2 (FST RW)    : D20
   *   ...
   *   Produit 8 (DENIMCOL)  : D80
   * Adresse Modbus = 4000 + numéro_registre (pour les D du Delta)
   */
  async writeTarget(productId, targetVolume) {
    if (!this.isConnected) {
      console.warn('⚠️ Modbus non connecté — consigne non écrite sur le PLC');
      return false;
    }
    
    try {
      // Le registre de consigne = D(productId * 10)
      // Adresse Modbus pour les registres D du Delta DVP : 4000 + n
      const registerAddress = 4000 + (productId * 10);
      
      // Delta DVP utilise des entiers 16 bits, on multiplie par 10 pour garder 1 décimale
      const value = Math.round(targetVolume * 10);
      
      await this.client.writeRegister(registerAddress, value);
      console.log(`✅ Consigne PLC écrite : D${productId * 10} = ${targetVolume} L (registre ${registerAddress} = ${value})`);
      return true;
    } catch (e) {
      console.error(`❌ Erreur écriture Modbus registre D${productId * 10}:`, e.message);
      return false;
    }
  }
}

module.exports = { ModbusClient };
