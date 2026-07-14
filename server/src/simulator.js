/**
 * ============================================================
 *  SARTEX FlowMaster — Simulateur de Dosage Industriel
 * ============================================================
 *  Ce module simule le comportement réel de l'automate Delta DVP.
 *  Il génère des données de dosage réalistes pour les 8 produits
 *  chimiques de l'usine Sartex, avec des anomalies occasionnelles
 *  pour démontrer la détection IA.
 * 
 *  En mode réel (usine), ce module est remplacé par modbusClient.js
 * ============================================================
 */

const EventEmitter = require('events');

/**
 * Configuration des 8 produits chimiques de Sartex
 * Les adresses PLC correspondent exactement au programme ISPSoft
 */
const PRODUCTS = [
  { id: 1, name: 'CHTT-AB35',   plcConsigne: 'D10',  plcDose: 'D102', plcFlag: 'M100', bufferAddr: 'D200', targetRange: [40, 60],  color: '#3B82F6' },
  { id: 2, name: 'FST RW',      plcConsigne: 'D20',  plcDose: 'D112', plcFlag: 'M200', bufferAddr: 'D210', targetRange: [25, 45],  color: '#10B981' },
  { id: 3, name: 'JAVEL',       plcConsigne: 'D30',  plcDose: 'D122', plcFlag: 'M300', bufferAddr: 'D220', targetRange: [15, 30],  color: '#F59E0B' },
  { id: 4, name: 'VESASITAM',   plcConsigne: 'D40',  plcDose: 'D132', plcFlag: 'M400', bufferAddr: 'D230', targetRange: [30, 50],  color: '#EF4444' },
  { id: 5, name: 'KAYA',        plcConsigne: 'D50',  plcDose: 'D142', plcFlag: 'M500', bufferAddr: 'D240', targetRange: [20, 40],  color: '#8B5CF6' },
  { id: 6, name: 'Hidrofil',    plcConsigne: 'D60',  plcDose: 'D152', plcFlag: 'M600', bufferAddr: 'D250', targetRange: [35, 55],  color: '#EC4899' },
  { id: 7, name: 'SERTENZIN',   plcConsigne: 'D70',  plcDose: 'D162', plcFlag: 'M700', bufferAddr: 'D260', targetRange: [10, 25],  color: '#14B8A6' },
  { id: 8, name: 'DENIMCOL',    plcConsigne: 'D80',  plcDose: 'D172', plcFlag: 'M800', bufferAddr: 'D270', targetRange: [45, 70],  color: '#F97316' }
];

class DosageSimulator extends EventEmitter {
  constructor() {
    super();
    this.products = PRODUCTS;
    this.activeDosages = {};     // Dosages en cours (produit -> état)
    this.completedCount = 0;    // Compteur total de dosages terminés
    this.intervalId = null;
    this.dosageCycleId = null;
    this.isRunning = false;

    // Compteur de dosages par produit (pour simuler la dérive/usure)
    this.dosageCounters = {};
    PRODUCTS.forEach(p => { this.dosageCounters[p.id] = 0; });
  }

  /**
   * Démarre la simulation
   * - Lance un nouveau dosage aléatoire toutes les 4-8 secondes
   * - Met à jour les dosages en cours toutes les 500ms (progression des jauges)
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🏭 Simulateur de dosage démarré');

    // Boucle principale : mise à jour de la progression (500ms)
    this.intervalId = setInterval(() => {
      this._updateActiveDosages();
    }, 500);

    // Boucle de lancement : nouveau dosage toutes les 4-8 secondes
    this._scheduleNextDosage();
  }

  /**
   * Arrête la simulation proprement
   */
  stop() {
    this.isRunning = false;
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.dosageCycleId) clearTimeout(this.dosageCycleId);
    this.activeDosages = {};
    console.log('⏹️  Simulateur arrêté');
  }

  /**
   * Planifie le prochain dosage avec un délai aléatoire
   */
  _scheduleNextDosage() {
    if (!this.isRunning) return;
    const delay = 4000 + Math.random() * 4000; // 4 à 8 secondes
    this.dosageCycleId = setTimeout(() => {
      this._startRandomDosage();
      this._scheduleNextDosage();
    }, delay);
  }

  /**
   * Démarre un dosage pour un produit aléatoire non occupé
   */
  _startRandomDosage() {
    // Trouver les produits qui ne sont pas en train de doser
    const availableProducts = this.products.filter(p => !this.activeDosages[p.id]);
    if (availableProducts.length === 0) return;

    // Choisir un produit au hasard
    const product = availableProducts[Math.floor(Math.random() * availableProducts.length)];

    // Calculer la consigne (volume cible)
    const [min, max] = product.targetRange;
    const targetVolume = +(min + Math.random() * (max - min)).toFixed(1);

    // Durée estimée basée sur un débit de 1.2 L/s (pour correspondre à seedHistory)
    let baseDuration = targetVolume / 1.2;

    // Simuler la dérive (usure de la pompe) : +0.1s par dosage au lieu d'un %
    this.dosageCounters[product.id]++;
    baseDuration += (this.dosageCounters[product.id] * 0.05); // Dérive très légère au fil du temps

    // Déterminer si ce dosage sera une anomalie (8% de chance)
    const willBeAnomaly = Math.random() < 0.08;
    let anomalyFactor = 1.0;
    let anomalyType = null;
    if (willBeAnomaly) {
      if (Math.random() < 0.5) {
        anomalyFactor = 1.12 + Math.random() * 0.08; // Surdosage +12% à +20%
        anomalyType = 'surdosage';
      } else {
        anomalyFactor = 0.80 + Math.random() * 0.08; // Sous-dosage -12% à -20%
        anomalyType = 'sous-dosage';
      }
    }

    // Enregistrer le dosage en cours
    this.activeDosages[product.id] = {
      product,
      targetVolume,
      actualTarget: +(targetVolume * anomalyFactor).toFixed(2),
      currentVolume: 0,
      startTime: Date.now(),
      duration: baseDuration * 1000,
      anomalyType,
      progress: 0
    };

    // Émettre l'événement de début
    this.emit('dosage:start', {
      productId: product.id,
      productName: product.name,
      targetVolume,
      color: product.color
    });
  }

  /**
   * Met à jour la progression de tous les dosages actifs
   * C'est cette fonction qui "remplit" les jauges en temps réel
   */
  _updateActiveDosages() {
    const now = Date.now();
    const updates = [];

    for (const [productId, dosage] of Object.entries(this.activeDosages)) {
      const elapsed = now - dosage.startTime;
      const progress = Math.min(elapsed / dosage.duration, 1.0);

      // Calcul du volume actuel avec une courbe réaliste (légère accélération puis ralentissement)
      const easedProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      dosage.currentVolume = +(dosage.actualTarget * easedProgress).toFixed(2);
      dosage.progress = +(progress * 100).toFixed(1);

      updates.push({
        productId: parseInt(productId),
        productName: dosage.product.name,
        targetVolume: dosage.targetVolume,
        currentVolume: dosage.currentVolume,
        progress: dosage.progress,
        color: dosage.product.color,
        status: progress >= 1.0 ? 'completed' : 'active'
      });

      // Dosage terminé
      if (progress >= 1.0) {
        this.completedCount++;
        const duration = (elapsed / 1000).toFixed(1);

        this.emit('dosage:complete', {
          productId: parseInt(productId),
          productName: dosage.product.name,
          targetVolume: dosage.targetVolume,
          actualVolume: dosage.currentVolume,
          durationSeconds: parseFloat(duration),
          anomalyType: dosage.anomalyType,
          color: dosage.product.color
        });

        delete this.activeDosages[productId];
      }
    }

    if (updates.length > 0) {
      this.emit('dosage:update', updates);
    }

    // Émettre aussi un état global (pour les jauges des produits inactifs)
    const allProductStates = this.products.map(p => {
      const active = this.activeDosages[p.id];
      if (active) {
        return {
          productId: p.id,
          productName: p.name,
          targetVolume: active.targetVolume,
          currentVolume: active.currentVolume,
          progress: active.progress,
          color: p.color,
          status: 'active'
        };
      }
      return {
        productId: p.id,
        productName: p.name,
        targetVolume: 0,
        currentVolume: 0,
        progress: 0,
        color: p.color,
        status: 'idle'
      };
    });

    this.emit('products:state', allProductStates);
  }

  /**
   * Met à jour la consigne (volume cible) d'un produit
   * @param {number} productId - ID du produit (1-8)
   * @param {number} newTarget - Nouveau volume cible en litres
   */
  updateTarget(productId, newTarget) {
    const product = this.products.find(p => p.id === productId);
    if (product) {
      // On fixe le range autour de la nouvelle cible (±5%)
      const margin = Math.max(1, newTarget * 0.05);
      product.targetRange = [+(newTarget - margin).toFixed(1), +(newTarget + margin).toFixed(1)];
      console.log(`🎯 Consigne produit ${product.name} mise à jour : ${newTarget} L (±${margin.toFixed(1)})`);
      return true;
    }
    return false;
  }

  /**
   * Retourne les consignes actuelles de tous les produits
   */
  getTargets() {
    return this.products.map(p => ({
      id: p.id,
      name: p.name,
      target: +((p.targetRange[0] + p.targetRange[1]) / 2).toFixed(1),
      min: p.targetRange[0],
      max: p.targetRange[1]
    }));
  }

  /**
   * Réinitialise les compteurs et les dosages actifs (pour reset démo)
   */
  resetCounters() {
    this.activeDosages = {};
    this.completedCount = 0;
    PRODUCTS.forEach(p => { this.dosageCounters[p.id] = 0; });
    console.log('🔄 Compteurs du simulateur réinitialisés');
  }

  /**
   * Retourne la configuration des produits (utile pour le frontend)
   */
  getProductsConfig() {
    return this.products;
  }
}

module.exports = { DosageSimulator, PRODUCTS };
