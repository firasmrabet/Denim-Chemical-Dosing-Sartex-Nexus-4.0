/**
 * ============================================================
 *  SARTEX FlowMaster — Moteur d'Intelligence Artificielle
 * ============================================================
 *  Ce module implémente 3 algorithmes d'IA industrielle :
 *
 *  1. DÉTECTION D'ANOMALIES (Z-Score)
 *     Identifie les dosages anormalement hauts ou bas par rapport
 *     à l'historique du produit. Précision cible : 95%
 *
 *  2. MAINTENANCE PRÉDICTIVE (Régression Linéaire)
 *     Analyse la dérive temporelle des durées de dosage pour
 *     prédire les pannes de pompes avant qu'elles ne surviennent.
 *
 *  3. SCORE DE SANTÉ MACHINE
 *     Calcule un score de 0 à 100% pour chaque pompe basé
 *     sur la régularité des dosages et la tendance de durée.
 * ============================================================
 */

const ss = require('simple-statistics');
const regression = require('regression');

class AIEngine {
  constructor(dbQueries) {
    this.queries = dbQueries;
    // Seuil du Z-score pour détecter une anomalie (2 = 95% de confiance)
    this.ANOMALY_THRESHOLD = 2.0;
    // Nombre minimum de dosages pour que l'IA commence à analyser
    this.MIN_SAMPLES = 5;
  }

  /**
   * =========================================
   *  ALGORITHME 1 : Détection d'Anomalies
   * =========================================
   * Principe du Z-Score :
   *   Z = (valeur - moyenne) / écart-type
   *   Si |Z| > 2.0, la valeur est statistiquement anormale
   *   (en dehors de 95% de la distribution normale)
   *
   * @param {number} productId - ID du produit (1 à 8)
   * @param {number} actualVolume - Volume réellement dosé
   * @returns {object|null} Détails de l'anomalie ou null si normal
   */
  detectAnomaly(productId, actualVolume) {
    // Récupérer l'historique des dosages de ce produit
    const history = this.queries.getDosagesForAI.all(productId);

    // Pas assez de données pour une analyse fiable
    if (history.length < this.MIN_SAMPLES) {
      return null;
    }

    // Extraire les volumes historiques
    const volumes = history.map(d => d.actual_volume);

    // Calculs statistiques
    const mean = ss.mean(volumes);
    const stddev = ss.standardDeviation(volumes);

    // Éviter la division par zéro (tous les dosages identiques)
    if (stddev === 0) return null;

    // Calcul du Z-Score
    const zScore = (actualVolume - mean) / stddev;
    const absZScore = Math.abs(zScore);

    // Anomalie détectée ?
    if (absZScore > this.ANOMALY_THRESHOLD) {
      const anomalyType = zScore > 0 ? 'surdosage' : 'sous-dosage';
      const severity = absZScore > 3 ? 'critical' : 'warning';
      const deviationPercent = (((actualVolume - mean) / mean) * 100).toFixed(1);

      return {
        isAnomaly: true,
        anomalyType,
        severity,
        zScore: +zScore.toFixed(3),
        expectedValue: +mean.toFixed(2),
        actualValue: actualVolume,
        deviationPercent: +deviationPercent,
        message: `${anomalyType === 'surdosage' ? '⬆️ Surdosage' : '⬇️ Sous-dosage'} détecté ! ` +
                 `Volume: ${actualVolume}L (attendu: ~${mean.toFixed(1)}L, écart: ${deviationPercent}%)`
      };
    }

    return null;
  }

  /**
   * =============================================
   *  ALGORITHME 2 : Maintenance Prédictive
   * =============================================
   * Principe : On surveille les DURÉES de dosage.
   * Si une pompe met de plus en plus de temps pour doser
   * la même quantité, c'est qu'elle perd en efficacité
   * (filtre bouché, usure mécanique, etc.)
   *
   * On utilise la régression linéaire :
   *   durée = a * (numéro_dosage) + b
   *   Si 'a' est positif et significatif, la pompe s'use.
   *
   * @param {number} productId - ID du produit
   * @returns {object} Résultat de la prédiction
   */
  predictMaintenance(productId) {
    const history = this.queries.getDosagesForAI.all(productId);

    if (history.length < this.MIN_SAMPLES) {
      return {
        healthScore: 100,
        trend: 'stable',
        trendSlope: 0,
        avgDuration: 0,
        predictedFailureDays: null,
        message: 'Pas assez de données pour analyser la tendance'
      };
    }

    // Normaliser les durées par le volume (secondes par litre)
    const dataPoints = history
      .filter(d => d.duration_seconds > 0 && d.actual_volume > 0)
      .reverse()  // Du plus ancien au plus récent
      .map((d, i) => [i, d.duration_seconds / d.actual_volume]);

    if (dataPoints.length < this.MIN_SAMPLES) {
      return {
        healthScore: 100,
        trend: 'stable',
        trendSlope: 0,
        avgDuration: 0,
        predictedFailureDays: null,
        message: 'Données insuffisantes'
      };
    }

    // Régression linéaire : y = a*x + b
    const result = regression.linear(dataPoints);
    const slope = result.equation[0];  // 'a' = pente
    const intercept = result.equation[1]; // 'b' = ordonnée à l'origine

    // Calcul du score de santé
    // Plus la pente est positive (durée augmente), plus le score baisse
    const durations = dataPoints.map(d => d[1]);
    const avgDuration = ss.mean(durations);
    const recentAvg = ss.mean(durations.slice(-3));
    const baselineAvg = ss.mean(durations.slice(0, Math.min(3, durations.length)));

    // Ratio dégradation
    const degradationRatio = baselineAvg > 0 ? recentAvg / baselineAvg : 1;
    let healthScore = Math.max(0, Math.min(100, 100 / degradationRatio));

    // Déterminer la tendance
    let trend = 'stable';
    let predictedFailureDays = null;

    if (slope > 0.005) {
      trend = 'degrading';
      // Prédire quand le health score tombera à 30%
      // (seuil critique de maintenance)
      const criticalDuration = baselineAvg * (100 / 30);
      const dosagesUntilFailure = (criticalDuration - recentAvg) / (slope > 0 ? slope : 0.001);
      // En supposant ~20 dosages par jour
      predictedFailureDays = Math.max(1, Math.round(dosagesUntilFailure / 20));
    } else if (slope < -0.002) {
      trend = 'improving';
    }

    return {
      healthScore: Math.round(healthScore),
      trend,
      trendSlope: +slope.toFixed(6),
      avgDuration: +avgDuration.toFixed(3),
      predictedFailureDays,
      regressionEquation: `durée = ${slope.toFixed(4)} × n + ${intercept.toFixed(4)}`,
      r2: result.r2,
      message: trend === 'degrading'
        ? `⚠️ Dégradation détectée ! Maintenance recommandée dans ${predictedFailureDays} jours`
        : trend === 'improving'
          ? '✅ Performance en amélioration'
          : '✅ Fonctionnement normal'
    };
  }

  /**
   * =============================================
   *  ALGORITHME 3 : Analyse Globale
   * =============================================
   * Génère un rapport complet pour tous les produits
   */
  generateFullAnalysis() {
    const stats = this.queries.getStatsByProduct.all();
    const analysis = {
      globalHealthScore: 0,
      products: [],
      recommendations: [],
      totalDosages: 0,
      totalAnomalies: 0
    };

    let totalHealth = 0;
    let productCount = 0;

    for (const stat of stats) {
      const maintenance = this.predictMaintenance(stat.product_id);
      const anomalyRate = stat.total_dosages > 0
        ? ((stat.anomaly_count / stat.total_dosages) * 100).toFixed(1)
        : 0;

      analysis.products.push({
        productId: stat.product_id,
        productName: stat.product_name,
        totalDosages: stat.total_dosages,
        avgVolume: +parseFloat(stat.avg_volume || 0).toFixed(2),
        minVolume: +parseFloat(stat.min_volume || 0).toFixed(2),
        maxVolume: +parseFloat(stat.max_volume || 0).toFixed(2),
        avgDuration: +parseFloat(stat.avg_duration || 0).toFixed(2),
        anomalyCount: stat.anomaly_count,
        anomalyRate: +anomalyRate,
        healthScore: maintenance.healthScore,
        trend: maintenance.trend,
        predictedFailureDays: maintenance.predictedFailureDays
      });

      totalHealth += maintenance.healthScore;
      productCount++;
      analysis.totalDosages += stat.total_dosages;
      analysis.totalAnomalies += stat.anomaly_count;

      // Générer des recommandations
      if (maintenance.trend === 'degrading') {
        analysis.recommendations.push({
          type: 'maintenance',
          severity: 'warning',
          product: stat.product_name,
          message: `Planifier maintenance pompe ${stat.product_name} dans ${maintenance.predictedFailureDays} jours`
        });
      }
      if (+anomalyRate > 10) {
        analysis.recommendations.push({
          type: 'quality',
          severity: 'critical',
          product: stat.product_name,
          message: `Taux d'anomalies élevé (${anomalyRate}%) pour ${stat.product_name} — Vérifier le calibrage`
        });
      }
    }

    analysis.globalHealthScore = productCount > 0 ? Math.round(totalHealth / productCount) : 100;

    return analysis;
  }
}

module.exports = { AIEngine };
