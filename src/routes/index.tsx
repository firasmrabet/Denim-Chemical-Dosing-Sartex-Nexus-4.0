import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, Cpu, Droplets, Gauge, Zap, Settings, RotateCcw, Database, Save } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/sartex/Layout";
import { CircularGauge } from "@/components/sartex/CircularGauge";
import { SCADADiagram } from "@/components/sartex/SCADADiagram";
import { PRODUCTS, PRODUCT_MAP } from "@/lib/sartex/products";
import { useSocket } from "@/hooks/useSocket";
// Import supprimé : l'IA est maintenant gérée par le backend Python

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Monitoring Live · Sartex Nexus 4.0" },
      {
        name: "description",
        content:
          "Vue temps réel des 8 pompes de dosage denim : jauges circulaires, animation 3D de la cuve et flux PLC en direct.",
      },
    ],
  }),
  component: MonitoringPage,
});

function MonitoringPage() {
  const { history, latestEvent: latest, mode, setMode, activeProducts, isConnected, targets: liveTargets, setTargets: setLiveTargets } = useSocket();
  const [nowStr, setNowStr] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [targets, setTargets] = useState<Record<number, number>>({});
  const [resetConfirm, setResetConfirm] = useState(false);

  useEffect(() => {
    // Initialiser le composant au montage (évite les erreurs Hydration Mismatch car ignoré par le SSR)
    setNowStr(new Date().toLocaleString("fr-FR", { hour12: false }));
    const timer = setInterval(() => {
      setNowStr(new Date().toLocaleString("fr-FR", { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [pulse, setPulse] = useState(0);
  const lastToastId = useRef<string | null>(null);

  // per-product last values
  const perProduct = useMemo(() => {
    const map = new Map<string, { volume: number; anomaly: boolean; ts: number }>();
    for (const e of history) {
      map.set(e.productId, { volume: e.volume, anomaly: e.anomaly, ts: e.timestamp });
    }
    return map;
  }, [history]);

  const stats = useMemo(() => {
    const today = Date.now() - 86_400_000;
    const todays = history.filter((h) => h.timestamp > today);
    const totalL = todays.reduce((s, e) => s + e.volume, 0);
    const anomalies = todays.filter(h => h.anomaly);
    return {
      batches: todays.length,
      totalL,
      anomalies: anomalies.length,
      products: PRODUCTS.length,
    };
  }, [history]);

  useEffect(() => {
    if (!latest) return;
    setPulse((p) => p + 1);
    if (latest.anomaly && lastToastId.current !== latest.id) {
      lastToastId.current = latest.id;
      toast.error(`ANOMALIE · ${PRODUCT_MAP[latest.productId].name}`, {
        description: `Surdosage détecté — ${latest.volume.toFixed(1)} L (cible ${latest.target} L)`,
        icon: <AlertTriangle className="h-4 w-4" />,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest?.id]);

  const colors = PRODUCTS.map((p) => p.color);
  const feed = history.slice(-14).reverse();

  return (
    <AppShell mode={mode} onToggleMode={setMode}>
      {/* Hero */}
      <section className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.3em] text-muted-foreground"
          >
            <span className={`live-dot inline-flex h-2 w-2 rounded-full ${isConnected ? "bg-[color:var(--color-cyan-neon)]" : "bg-destructive"}`} />
            <span>{isConnected ? "Live · Ksar Hellal · Ligne Denim #3" : "Hors Ligne"}</span>
            <span className="text-white/30">/</span>
            <span className="font-mono min-w-[150px] inline-block">
              {nowStr}
            </span>
          </motion.div>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight md:text-5xl">
            Monitoring de dosage <span className="text-gradient-cyan">chimique</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
            8 pompes doseuses supervisées via le PLC Delta DVP. Les données Modbus sont
            consolidées ici en temps réel, prêtes à alimenter les modèles IA de maintenance
            prédictive.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:min-w-[420px] lg:grid-cols-4">
          <KPI icon={Droplets} label="Batches / 24h" value={stats.batches.toString()} />
          <KPI
            icon={Gauge}
            label="Volume dosé"
            value={`${stats.totalL.toFixed(0)} L`}
          />
          <KPI icon={Cpu} label="Produits actifs" value={stats.products.toString()} />
          <KPI
            icon={AlertTriangle}
            label="Anomalies"
            value={stats.anomalies.toString()}
            alert={stats.anomalies > 0}
          />
        </div>
      </section>

      {/* Admin Toggle Button */}
      <div className="mt-4 flex justify-end">
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            setShowAdmin(!showAdmin);
            if (!showAdmin) {
              // Charger les consignes actuelles
              fetch('http://localhost:3001/api/admin/targets')
                .then(r => r.json())
                .then((data: any[]) => {
                  const t: Record<number, number> = {};
                  data.forEach(d => { t[d.id] = d.target; });
                  setTargets(t);
                })
                .catch(console.error);
            }
          }}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-all ${
            showAdmin
              ? "border-[color:var(--color-cyan-neon)]/50 bg-[color:var(--color-cyan-neon)]/10 text-[color:var(--color-cyan-neon)]"
              : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white"
          }`}
        >
          <Settings className="h-4 w-4" />
          {showAdmin ? "Fermer Admin" : "⚙️ Panneau Admin"}
        </motion.button>
      </div>

      {/* Admin Panel */}
      {showAdmin && (
        <motion.section
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 card-industrial overflow-hidden"
        >
          <div className="border-b border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Administration</div>
                <div className="mt-1 text-lg font-semibold">Contrôle <span className="text-gradient-cyan">Démonstration</span></div>
              </div>
              <div className="flex items-center gap-2">
                {/* Bouton Restaurer */}
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={async () => {
                    try {
                      const res = await fetch('http://localhost:3001/api/admin/restore', { method: 'POST' });
                      const data = await res.json();
                      if (res.ok) {
                        toast.success('Données restaurées !', { description: data.message });
                        setTimeout(() => window.location.reload(), 500);
                      } else {
                        toast.error('Erreur', { description: data.error });
                      }
                    } catch { toast.error('Serveur inaccessible'); }
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                >
                  <Database className="h-4 w-4" />
                  Restaurer Backup
                </motion.button>

                {/* Bouton Reset Démo */}
                {!resetConfirm ? (
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setResetConfirm(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/20"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Réinitialiser Démo
                  </motion.button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-destructive font-semibold">Confirmer ?</span>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={async () => {
                        try {
                          await fetch('http://localhost:3001/api/admin/reset', { method: 'POST' });
                          toast.success('🔄 Démonstration réinitialisée', { description: 'Toutes les données ont été remises à zéro. Backup conservé.' });
                          setResetConfirm(false);
                        } catch { toast.error('Erreur serveur'); }
                      }}
                      className="rounded-lg bg-destructive px-3 py-2 text-sm font-bold text-white"
                    >
                      ✓ Oui, reset
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setResetConfirm(false)}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                    >
                      ✕ Annuler
                    </motion.button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Consignes des 8 produits */}
          <div className="p-4">
            <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Consignes de dosage (Litres)</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PRODUCTS.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <span className="h-8 w-1 rounded-full" style={{ background: p.color, boxShadow: `0 0 8px ${p.glow}` }} />
                  <div className="flex-1">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">{p.name}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={200}
                        step={0.5}
                        value={targets[PRODUCTS.indexOf(p) + 1] ?? p.target}
                        onChange={(e) => setTargets(prev => ({ ...prev, [PRODUCTS.indexOf(p) + 1]: parseFloat(e.target.value) || 0 }))}
                        className="w-20 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm font-mono text-white outline-none focus:border-[color:var(--color-cyan-neon)]/60"
                      />
                      <span className="text-xs text-muted-foreground">L</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={async () => {
                  let count = 0;
                  for (const [productId, target] of Object.entries(targets)) {
                    if (target > 0) {
                      // Mise à jour immédiate côté client pour un retour visuel instantané
                      setLiveTargets(prev => ({ ...prev, [parseInt(productId)]: target }));
                      
                      await fetch('http://localhost:3001/api/admin/targets', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ productId: parseInt(productId), target })
                      });
                      count++;
                    }
                  }
                  toast.success(`${count} consignes appliquées`, { description: 'Les prochains dosages utiliseront les nouvelles cibles.' });
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[color:var(--color-cyan-neon)] to-[color:var(--color-blue-neon)] px-5 py-2 text-sm font-bold text-black glow-cyan"
              >
                <Save className="h-4 w-4" />
                Appliquer les consignes
              </motion.button>
            </div>
          </div>
        </motion.section>
      )}

      {/* Main grid */}
      <section className="mt-8 grid gap-6 xl:grid-cols-[1fr_460px]">
        {/* Left: 3D + gauges */}
        <div className="space-y-6">
          <div className="card-industrial flex flex-col overflow-hidden">
            {/* Header / Info bar */}
            <div className="flex items-start justify-between border-b border-white/5 p-4 bg-white/[0.02]">
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  Supervision Temps Réel
                </div>
                <div className="mt-1 text-lg font-semibold">
                  Sartex <span className="text-gradient-cyan">SCADA HMI</span>
                </div>
              </div>
              <div className="glass flex items-center gap-4 rounded-lg px-3 py-2">
                <div className="text-right">
                  <div className="text-[8px] uppercase tracking-widest text-muted-foreground">
                    Cycle Actuel
                  </div>
                  <div className="font-mono text-xs">
                    T0 · K10 · <span className="text-[color:var(--color-cyan-neon)]">RUN</span>
                  </div>
                </div>
                <div className="h-6 w-px bg-white/10" />
                <div className="flex items-center gap-1">
                  {PRODUCTS.map((p) => (
                    <span
                      key={p.id}
                      className="h-1.5 w-4 rounded-full transition-all"
                      style={{
                        background:
                          latest?.productId === p.id ? p.color : "rgba(255,255,255,0.08)",
                        boxShadow:
                          latest?.productId === p.id ? `0 0 8px ${p.glow}` : "none",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* SCADA Diagram */}
            <div className="relative h-[380px] p-2">
              <SCADADiagram activeProducts={activeProducts} latest={latest} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {PRODUCTS.map((p) => {
              const s = perProduct.get(p.id);
              const activeData = activeProducts[p.id];
              const isActive = activeData?.status === 'active';
              
              // Utiliser la cible dynamique si elle existe (mise à jour par l'admin), sinon la valeur par défaut
              // Note: le backend utilise des IDs numériques (1-8), le frontend des IDs textuels
              const numericId = PRODUCTS.indexOf(p) + 1;
              const currentTarget = liveTargets[numericId] || p.target;
              const dynamicProduct = { ...p, target: currentTarget };

              return (
                <CircularGauge
                  key={p.id}
                  product={dynamicProduct}
                  volume={isActive ? activeData.currentVolume : (s?.volume ?? 0)}
                  active={isActive}
                  anomaly={s?.anomaly ?? false}
                />
              );
            })}
          </div>
        </div>

        {/* Right: activity feed */}
        <aside className="card-industrial flex h-fit flex-col p-5 xl:sticky xl:top-24">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Flux d'activité
              </div>
              <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                <Activity className="h-4 w-4 text-[color:var(--color-cyan-neon)]" />
                PLC Live Stream
              </div>
            </div>
            <span className="ticker-dot h-2 w-2 rounded-full bg-[color:var(--color-cyan-neon)]" />
          </div>
          <ul className="relative space-y-2">
            <AnimatePresence initial={false}>
              {feed.map((e) => {
                const p = PRODUCT_MAP[e.productId];
                return (
                  <motion.li
                    key={e.id}
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className={`glass flex items-center gap-3 rounded-lg px-3 py-2 text-xs ${
                      e.anomaly ? "ring-1 ring-destructive/60" : ""
                    }`}
                  >
                    <span
                      className="h-8 w-1 rounded-full"
                      style={{
                        background: p.color,
                        boxShadow: `0 0 8px ${p.glow}`,
                      }}
                    />
                    <div className="min-w-0 flex-1 py-0.5">
                      <div className="flex items-center justify-between font-mono text-sm">
                        <span className="truncate font-bold text-white/90">{p.name}</span>
                        <span className="text-white/80">
                          {new Date(e.timestamp).toLocaleTimeString("fr-FR", {
                            hour12: false,
                          })}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-white/70">
                        <span className="font-semibold text-white/80">
                          {p.plcBit} → {p.plcDst}
                        </span>
                        <span
                          className={e.anomaly ? "font-bold text-destructive" : "font-semibold text-white/90"}
                        >
                          {e.volume.toFixed(1)} L · {e.duration.toFixed(0)}s
                        </span>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </aside>
      </section>
    </AppShell>
  );
}

function KPI({
  icon: Icon,
  label,
  value,
  alert,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="card-industrial p-3"
      style={
        alert
          ? {
              boxShadow:
                "0 0 0 1px rgba(248,113,113,0.5), 0 0 24px -6px rgba(248,113,113,0.5)",
            }
          : undefined
      }
    >
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${alert ? "text-destructive" : "text-[color:var(--color-cyan-neon)]"}`} />
        {label}
      </div>
      <div className={`mt-2 text-2xl font-bold ${alert ? "text-destructive" : ""}`}>
        {value}
      </div>
    </motion.div>
  );
}
