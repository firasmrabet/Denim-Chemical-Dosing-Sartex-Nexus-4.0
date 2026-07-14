import os
import sqlite3
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from flask import Flask, jsonify
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)

DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'dosages.db')

# Informations sur les produits pour les insights et la sante
PRODUCTS = {
    1: {"id": 1, "name": "CHTT-AB35", "target": 42, "baseDuration": 38, "color": "#3B82F6"},
    2: {"id": 2, "name": "FST RW", "target": 28, "baseDuration": 32, "color": "#10B981"},
    3: {"id": 3, "name": "JAVEL", "target": 35, "baseDuration": 30, "color": "#F59E0B"},
    4: {"id": 4, "name": "VESASITAM", "target": 18, "baseDuration": 22, "color": "#EF4444"},
    5: {"id": 5, "name": "KAYA", "target": 25, "baseDuration": 40, "color": "#8B5CF6"},
    6: {"id": 6, "name": "Hidrofil", "target": 32, "baseDuration": 28, "color": "#EC4899"},
    7: {"id": 7, "name": "SERTENZIN", "target": 22, "baseDuration": 34, "color": "#14B8A6"},
    8: {"id": 8, "name": "DENIMCOL", "target": 46, "baseDuration": 44, "color": "#F97316"}
}

CLOG_THRESHOLD_MULTIPLIER = 1.6


def get_dosages_df(limit=500, order='DESC'):
    """Charge les dosages depuis SQLite et parse les timestamps de maniere robuste."""
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql_query(
        f"SELECT * FROM dosages ORDER BY timestamp {order} LIMIT {limit}", conn
    )
    conn.close()

    if df.empty:
        return df

    # Normaliser les timestamps : remplacer espace par T et garder que les 19 premiers chars (YYYY-MM-DDTHH:MM:SS)
    df['timestamp'] = df['timestamp'].str.replace(' ', 'T', regex=False)
    df['timestamp'] = df['timestamp'].str[:19]
    # Parser en datetime naive (sans timezone)
    df['timestamp_dt'] = pd.to_datetime(df['timestamp'], errors='coerce')
    # Supprimer les lignes avec des dates invalides
    df = df.dropna(subset=['timestamp_dt'])

    return df


@app.route('/api/ai/anomalies', methods=['GET'])
def get_anomalies():
    """Detection d'anomalies Z-Score sur l'historique (Dernières 24h)"""
    df = get_dosages_df(limit=2000, order='DESC')

    if df.empty:
        return jsonify([])

    out = []

    for product_id, group in df.groupby('product_id'):
        if len(group) < 8:
            continue

        # Détection d'anomalie sur le volume dosé (différence actual - target)
        group = group.copy()
        group['volume_diff'] = group['actual_volume'] - group['target_volume']
        mean_diff = group['volume_diff'].mean()
        std_diff = group['volume_diff'].std()
        if std_diff == 0:
            std_diff = 1e-6

        # Filtrer pour évaluer uniquement les événements des dernières 24 heures
        now = datetime.now()
        recent = group[group['timestamp_dt'] >= now - pd.Timedelta(days=1)]

        for _, row in recent.iterrows():
            current_diff = row['actual_volume'] - row['target_volume']
            z = abs(current_diff - mean_diff) / std_diff
            
            # Seuil Z-score dynamique pour correspondre à l'historique
            if z > 1.5 or int(row.get('is_anomaly', 0)) == 1:
                out.append({
                    "event": {
                        "id": str(row['id']),
                        "productId": int(row['product_id']),
                        "volume": float(row['actual_volume']),
                        "target": float(row['target_volume']),
                        "duration": float(row['duration_seconds']),
                        "timestamp": float(row['timestamp_dt'].timestamp() * 1000),
                    },
                    "z": round(float(z), 4),
                    "severity": "critical" if z >= 2.5 else "warn"
                })

    out.sort(key=lambda x: x['event']['timestamp'], reverse=True)
    return jsonify(out)


@app.route('/api/ai/health', methods=['GET'])
def get_health():
    """Regression lineaire (scikit-learn) pour predire la sante et la date de panne"""
    df = get_dosages_df(limit=5000, order='ASC')

    if df.empty:
        return jsonify([])

    results = []
    now_ts = datetime.now()

    for product_id, spec in PRODUCTS.items():
        group = df[df['product_id'] == product_id].copy()

        if len(group) < 6:
            results.append({
                "productId": product_id,
                "score": 100,
                "slope": 0.0,
                "predictedFailureAt": None,
                "currentDuration": float(spec['baseDuration']),
                "baseline": float(spec['baseDuration'])
            })
            continue

        t0_dt = group['timestamp_dt'].iloc[0]
        # Convertir en python datetime naif si c'est un pandas Timestamp
        if hasattr(t0_dt, 'to_pydatetime'):
            t0_dt = t0_dt.to_pydatetime().replace(tzinfo=None)

        # X = nombre de jours depuis le premier dosage
        x_days = np.array([(ts.to_pydatetime().replace(tzinfo=None) - t0_dt).total_seconds() / 86400.0
                           for ts in group['timestamp_dt']])

        # Y = duree normalisee (sec/L * target) pour annuler la variance du volume cible
        actual_vol = group['actual_volume'].values
        actual_vol[actual_vol == 0] = 1  # eviter division par zero
        sec_per_litre = group['duration_seconds'].values / actual_vol
        y_normalized = sec_per_litre * spec['target']

        # Regression lineaire avec scikit-learn
        model = LinearRegression()
        X_matrix = x_days.reshape(-1, 1)
        model.fit(X_matrix, y_normalized)

        slope = float(model.coef_[0])
        intercept = float(model.intercept_)

        now_day = (now_ts - t0_dt).total_seconds() / 86400.0
        current_duration = slope * now_day + intercept
        clog_at = spec['baseDuration'] * CLOG_THRESHOLD_MULTIPLIER

        raw_score = (clog_at - current_duration) / (clog_at - spec['baseDuration'])
        score = max(0, min(100, int(round(raw_score * 100))))

        predicted = None
        if slope > 0.01:
            days_until = (clog_at - intercept) / slope
            predicted_epoch_ms = (t0_dt.timestamp() + days_until * 86400) * 1000

            if predicted_epoch_ms < now_ts.timestamp() * 1000:
                predicted_epoch_ms = now_ts.timestamp() * 1000 + 3600000

            predicted = predicted_epoch_ms

        results.append({
            "productId": product_id,
            "score": score,
            "slope": slope,
            "predictedFailureAt": predicted,
            "currentDuration": float(current_duration),
            "baseline": float(spec['baseDuration'])
        })

    return jsonify(results)


@app.route('/api/ai/insights', methods=['GET'])
def get_insights():
    """Moteur d'insights (surdosage)"""
    df = get_dosages_df(limit=600, order='DESC')

    if df.empty:
        return jsonify([])

    out = []

    for product_id, spec in PRODUCTS.items():
        group = df[df['product_id'] == product_id].head(60)

        if len(group) < 10:
            continue

        avg_vol = float(group['actual_volume'].mean())
        target = spec['target']

        overshoot_pct = ((avg_vol - target) / target) * 100
        # Seuil rabaissé à 0.5%
        if overshoot_pct <= 0.5:
            continue

        wasted_per_dose = avg_vol - target
        doses_per_month = 30 * 24
        wasted_litres = wasted_per_dose * doses_per_month
        monthly_savings = wasted_litres * 3.5  # 3.5 TND / L

        out.append({
            "productId": product_id,
            "overshootPct": round(overshoot_pct, 2),
            "wastedLitres": round(wasted_litres, 1),
            "monthlySavings": round(monthly_savings, 1)
        })

    out.sort(key=lambda x: x['monthlySavings'], reverse=True)
    return jsonify(out)


if __name__ == '__main__':
    print("[SARTEX AI CORE] Demarrage du microservice Python sur le port 5000...")
    print("[SARTEX AI CORE] Endpoints:")
    print("  GET /api/ai/anomalies  -> Detection Z-Score")
    print("  GET /api/ai/health     -> Regression lineaire (scikit-learn)")
    print("  GET /api/ai/insights   -> Optimisation recette")
    app.run(host='0.0.0.0', port=5000)
