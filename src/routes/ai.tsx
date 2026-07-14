import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Brain, Sparkles, TrendingDown, Wrench } from "lucide-react";
import { AppShell } from "@/components/sartex/Layout";
import { PRODUCTS, PRODUCT_MAP } from "@/lib/sartex/products";
import { useSocket } from "@/hooks/useSocket";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: "AI Analytics · Sartex Nexus 4.0" },
      {
        name: "description",
        content:
          "Détection d'anomalies Z-score, maintenance prédictive par régression linéaire et optimisation de recette pour la ligne denim Sartex.",
      },
    ],
  }),
  component: AiPage,
});

function AiPage() {
  const { history, mode, setMode } = useSocket();

  // Mapping: Python utilise des IDs numériques (1..8), React utilise des IDs string ("CHTT-AB35"...)
  const PRODUCT_ID_MAP: Record<number, string> = {};
  PRODUCTS.forEach((p, idx) => { PRODUCT_ID_MAP[idx + 1] = p.id; });

  // État local pour stocker les résultats du microservice Python
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [health, setHealth] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);

  useEffect(() => {
    // Fonction pour interroger le cerveau Python
    const fetchAI = async () => {
      try {
        const [resA, resH, resI] = await Promise.all([
          fetch("http://localhost:5000/api/ai/anomalies").then(r => r.json()),
          fetch("http://localhost:5000/api/ai/health").then(r => r.json()),
          fetch("http://localhost:5000/api/ai/insights").then(r => r.json())
        ]);

        // Convertir les productId numériques Python en string ProductId React
        setAnomalies(resA.map((a: any) => ({
          ...a,
          event: { ...a.event, productId: PRODUCT_ID_MAP[a.event.productId] || a.event.productId }
        })));
        setHealth(resH.map((h: any) => ({
          ...h,
          productId: PRODUCT_ID_MAP[h.productId] || h.productId
        })));
        setInsights(resI.map((i: any) => ({
          ...i,
          productId: PRODUCT_ID_MAP[i.productId] || i.productId
        })));
      } catch (err) {
        console.error("Erreur de connexion au moteur Python:", err);
      }
    };

    fetchAI();
    // Rafraîchir toutes les 5 secondes
    const interval = setInterval(fetchAI, 5000);
    return () => clearInterval(interval);
  }, []);

  // Duration drift chart: last 60 doses per product, day index vs duration
  const driftData = useMemo(() => {
    const grouped: Record<string, any> = {};
    const now = Date.now();
    for (const e of history) {
      // Group by 1-hour windows to fix performance lag (reduces 2000 points to max 168)
      const hourOffset = Math.round((e.timestamp - now) / 3600000);
      const dayOffsetFloat = hourOffset / 24; 
      
      if (!grouped[hourOffset]) {
        grouped[hourOffset] = { t: parseFloat(dayOffsetFloat.toFixed(3)), count: {} };
      }
      
      const secPerLitre = e.duration / (e.volume || 1);
      const target = PRODUCT_MAP[e.productId]?.target || 1;
      const normalizedDuration = secPerLitre * target;
      
      if (!grouped[hourOffset][e.productId]) {
          grouped[hourOffset][e.productId] = 0;
          grouped[hourOffset].count[e.productId] = 0;
      }
      
      grouped[hourOffset][e.productId] += normalizedDuration;
      grouped[hourOffset].count[e.productId] += 1;
    }
    
    // Compute averages
    return Object.values(grouped).map((g: any) => {
        const point: any = { t: g.t };
        for (const pId of Object.keys(g)) {
            if (pId !== 't' && pId !== 'count') {
                point[pId] = parseFloat((g[pId] / g.count[pId]).toFixed(1));
            }
        }
        return point;
    }).sort((a, b) => a.t - b.t);
  }, [history]);

  const radarData = health.map((h) => ({
    product: PRODUCT_MAP[h.productId].name,
    score: h.score,
  }));

  const globalScore = Math.round(
    health.reduce((s, h) => s + h.score, 0) / Math.max(1, health.length),
  );

  return (
    <AppShell mode={mode} onToggleMode={setMode}>
      {/* Header */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            <Brain className="h-3.5 w-3.5 text-[color:var(--color-cyan-neon)]" />
            Sartex AI Core · precision 95 %
          </div>
          <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">
            IA industrielle{" "}
            <span className="text-gradient-cyan">temps réel</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Trois algorithmes analysent en continu l'historique local :
            Z-score pour la détection d'anomalies, régression linéaire pour la
            maintenance prédictive des pompes, et un moteur d'insights pour
            optimiser la recette de dosage denim.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card-industrial relative flex items-center justify-between overflow-hidden p-5"
        >
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Global Health Score
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className={`text-5xl font-extrabold ${
                  globalScore < 40
                    ? "text-destructive"
                    : globalScore < 70
                      ? "text-[color:var(--color-warn)]"
                      : "text-gradient-cyan"
                }`}
              >
                {globalScore}
              </span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Moyenne des 8 pompes doseuses
            </div>
          </div>
          <div className="h-24 w-24">
            <ResponsiveContainer>
              {radarData.length > 0 ? (
                <RadarChart data={radarData} outerRadius={40}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="product" tick={false} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    dataKey="score"
                    stroke="#22d3ee"
                    fill="#22d3ee"
                    fillOpacity={0.35}
                  />
                </RadarChart>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Chargement...
                </div>
              )}
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Duration drift + health */}
      <section className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-industrial p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Maintenance prédictive · régression linéaire
              </div>
              <div className="mt-1 text-lg font-semibold">
                Dérive durée de dosage / jours
              </div>
            </div>
            <TrendingDown className="h-5 w-5 text-[color:var(--color-warn)]" />
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer>
              <LineChart data={driftData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="t"
                  stroke="rgba(255,255,255,0.4)"
                  tick={{ fontSize: 11 }}
                  domain={[-7, 0]}
                  type="number"
                  label={{
                    value: "jours (0 = adj)",
                    position: "insideBottom",
                    offset: -4,
                    fill: "rgba(255,255,255,0.4)",
                    fontSize: 10,
                  }}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.4)"
                  tick={{ fontSize: 11 }}
                  label={{
                    value: "sec (normalisé)",
                    angle: -90,
                    position: "insideLeft",
                    fill: "rgba(255,255,255,0.4)",
                    fontSize: 10,
                  }}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15,15,30,0.92)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {PRODUCTS.map((p) => (
                  <Line
                    key={p.id}
                    type="monotone"
                    dataKey={p.id}
                    stroke={p.color}
                    dot={true}
                    strokeWidth={2}
                    name={p.name}
                    connectNulls={true}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-industrial p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Health Score des pompes
              </div>
              <div className="mt-1 text-lg font-semibold">Vitalité par produit</div>
            </div>
            <Wrench className="h-5 w-5 text-[color:var(--color-cyan-neon)]" />
          </div>
          <ul className="space-y-3">
            {health.map((h) => {
              const p = PRODUCT_MAP[h.productId];
              const color =
                h.score < 30
                  ? "var(--color-destructive)"
                  : h.score < 60
                    ? "var(--color-warn)"
                    : "var(--color-ok)";
              return (
                <li key={h.productId}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-semibold">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: p.color, boxShadow: `0 0 6px ${p.glow}` }}
                      />
                      {p.name}
                    </span>
                    <span className="font-mono" style={{ color: `var(--tw-${color})` }}>
                      {h.score}%
                    </span>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${h.score}%` }}
                      transition={{ type: "spring", stiffness: 90, damping: 20 }}
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${color}, ${p.color})`,
                        boxShadow: `0 0 10px ${p.glow}`,
                      }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-white/80">
                    <span>durée actuelle {h.currentDuration.toFixed(1)}s</span>
                    <span>
                      {h.predictedFailureAt
                        ? `panne prédite ${new Date(h.predictedFailureAt).toLocaleDateString("fr-FR")}`
                        : "stable"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </motion.div>
      </section>

      {/* Anomalies + Insights */}
      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-industrial p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Z-score · seuil 2σ
              </div>
              <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Anomalies détectées
              </div>
            </div>
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">
              {anomalies.length}
            </span>
          </div>
          {anomalies.length === 0 ? (
            <div className="rounded-lg border border-white/5 bg-white/[0.03] p-6 text-center text-sm text-muted-foreground">
              Aucune anomalie sur la fenêtre analysée. Système nominal.
            </div>
          ) : (
            <div className="max-h-[350px] overflow-y-auto pr-2">
              <ul className="space-y-2">
                {anomalies.map((a) => {
                  const p = PRODUCT_MAP[a.event.productId];
                  return (
                    <li
                      key={a.event.id}
                      className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs"
                    >
                      <span
                        className="h-9 w-1 rounded-full"
                        style={{ background: p.color, boxShadow: `0 0 8px ${p.glow}` }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between font-semibold">
                          <span>{p.name}</span>
                          <span className="font-mono text-destructive">
                            Z = {a.z.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>
                            {a.event.volume.toFixed(1)} L · cible {a.event.target} L
                          </span>
                          <span className="font-mono">
                            {new Date(a.event.timestamp).toLocaleString("fr-FR", {
                              hour12: false,
                            })}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-industrial p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Optimisation de recette
              </div>
              <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                <Sparkles className="h-4 w-4 text-[color:var(--color-cyan-neon)]" />
                Insights économies
              </div>
            </div>
          </div>
          {insights.length === 0 ? (
            <div className="rounded-lg border border-white/5 bg-white/[0.03] p-6 text-center text-sm text-muted-foreground">
              Recette optimale — pas de surconsommation détectée.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-[color:var(--color-cyan-neon)]/25 bg-[color:var(--color-cyan-neon)]/[0.07] p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Économie mensuelle projetée
                </div>
                <div className="mt-1 text-3xl font-extrabold text-gradient-cyan">
                  {insights
                    .reduce((s, i) => s + i.monthlySavings, 0)
                    .toLocaleString("fr-FR", { maximumFractionDigits: 0 })}{" "}
                  TND
                </div>
              </div>
              <div className="max-h-[260px] overflow-y-auto pr-2">
                <ul className="space-y-2">
                  {insights.map((i) => {
                    const p = PRODUCT_MAP[i.productId];
                    return (
                      <li
                        key={i.productId}
                        className="rounded-lg border border-white/5 bg-white/[0.03] p-4 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 font-semibold">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ background: p.color }}
                            />
                            {p.name}
                          </span>
                          <span className="font-mono font-bold text-base text-[color:var(--color-warn)]">
                            +{i.overshootPct.toFixed(1)}% surdosage
                          </span>
                        </div>
                        <div className="mt-2 text-white/90">
                          Réduire la cible de{" "}
                          <span className="font-bold text-white">
                            ~{(i.overshootPct * 0.8).toFixed(1)}%
                          </span>{" "}
                          économiserait{" "}
                          <span className="font-bold text-lg text-[color:var(--color-cyan-neon)]">
                            {i.wastedLitres.toFixed(0)} L/mois
                          </span>
                          .
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </motion.div>
      </section>

      {/* Volume distribution */}
      <section className="mt-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-industrial p-5"
        >
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Empreinte chimique
            </div>
            <div className="mt-1 text-lg font-semibold">
              Volume dosé par produit · 7 derniers jours
            </div>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer>
              <AreaChart data={buildDailyStack(history)}>
                <defs>
                  {PRODUCTS.map((p) => (
                    <linearGradient
                      key={p.id}
                      id={`fill-${p.id}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={p.color} stopOpacity={0.7} />
                      <stop offset="100%" stopColor={p.color} stopOpacity={0.05} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15,15,30,0.92)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                  }}
                />
                {PRODUCTS.map((p) => (
                  <Area
                    key={p.id}
                    type="monotone"
                    dataKey={p.id}
                    stackId="1"
                    stroke={p.color}
                    fill={`url(#fill-${p.id})`}
                    name={p.name}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </section>
    </AppShell>
  );
}

function buildDailyStack(history: { timestamp: number; productId: string; volume: number }[]) {
  const days: Record<string, Record<string, number> & { day: string }> = {};
  const now = Date.now();
  for (let d = 6; d >= 0; d--) {
    const date = new Date(now - d * 86_400_000);
    const key = date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
    days[key] = { day: key } as Record<string, number> & { day: string };
    for (const p of PRODUCTS) days[key][p.id] = 0;
  }
  const cutoff = now - 7 * 86_400_000;
  for (const e of history) {
    if (e.timestamp < cutoff) continue;
    const key = new Date(e.timestamp).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    });
    if (days[key]) days[key][e.productId] += e.volume;
  }
  return Object.values(days);
}
