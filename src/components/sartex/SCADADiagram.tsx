import { motion } from "framer-motion";
import { PRODUCTS } from "@/lib/sartex/products";
import { Zap, Activity, Droplet } from "lucide-react";

interface Props {
  activeProducts: Record<string, any>;
  latest?: any;
}

export function SCADADiagram({ activeProducts, latest }: Props) {
  return (
    <div className="relative flex h-full w-full flex-col justify-between p-2 font-mono text-[10px] text-muted-foreground">
      {/* Ligne des 8 cuves sources */}
      <div className="relative z-10 flex w-full">
        {PRODUCTS.map((p, i) => {
          const isActive = activeProducts[p.id]?.status === "active";
          return (
            <div key={p.id} className="flex flex-1 flex-col items-center">
              {/* Cuve Source */}
              <div
                className={`relative flex h-16 w-11 flex-col justify-end overflow-hidden rounded-t-md border-x-2 border-t-2 border-b-0 bg-[#0f172a] shadow-lg transition-colors duration-300 ${
                  isActive ? "border-[color:var(--color-cyan-neon)]" : "border-white/10"
                }`}
              >
                {/* Niveau de liquide */}
                <div
                  className="w-full transition-all duration-700 ease-in-out"
                  style={{
                    height: isActive ? "30%" : "70%",
                    background: p.color,
                    boxShadow: isActive ? `0 0 15px ${p.glow}` : "none",
                    opacity: isActive ? 1 : 0.6,
                  }}
                />
                {/* Reflet glossy */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent w-1/2" />
              </div>

              {/* Tag & Vanne */}
              <div className="mt-1 flex flex-col items-center">
                <div
                  className={`h-2.5 w-5 rounded-sm border border-black/50 shadow-inner transition-colors duration-300 ${
                    isActive ? "bg-green-500 shadow-[0_0_10px_#22c55e]" : "bg-red-900/50"
                  }`}
                />
                <span className={`mt-1 text-xs font-bold ${isActive ? "text-white" : "text-white/70"}`}>
                  {p.plcBit}
                </span>
                <span className="max-w-[50px] truncate text-center text-[10px] font-semibold text-white/90 uppercase leading-tight">
                  {p.name}
                </span>
              </div>

              {/* Tuyau vertical de descente (connecté au manifold) */}
              <div className="relative mt-1 h-10 w-2.5 border-x border-[#334155] bg-[#1e293b]">
                {isActive && (
                  <motion.div
                    className="absolute inset-0 opacity-90"
                    style={{
                      backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 4px, ${p.color} 4px, ${p.color} 8px)`,
                      boxShadow: `0 0 10px ${p.glow}`,
                    }}
                    animate={{ backgroundPosition: ["0px 0px", "0px 16px"] }}
                    transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Collecteur Principal (Manifold Horizontal) */}
      <div className="relative h-3 w-full border-y border-[#334155] bg-[#1e293b]">
        {PRODUCTS.map((p, i) => {
          const isActive = activeProducts[p.id]?.status === "active";
          if (!isActive) return null;

          const isLeft = i < 4;
          const centerPos = 12.5 * i + 6.25;
          const left = isLeft ? centerPos : 50;
          const width = isLeft ? 50 - centerPos : centerPos - 50;

          return (
            <motion.div
              key={p.id}
              className="absolute inset-y-0 opacity-90"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 6px, ${p.color} 6px, ${p.color} 12px)`,
                boxShadow: `0 0 10px ${p.glow}`,
              }}
              animate={{
                backgroundPosition: isLeft ? ["0px 0px", "24px 0px"] : ["0px 0px", "-24px 0px"],
              }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            />
          );
        })}
      </div>

      {/* Tuyau Vertical Principal vers le Mixer T-01 */}
      <div className="relative flex h-14 w-full justify-center">
        <div className="relative h-full w-4 border-x border-[#334155] bg-[#1e293b]">
          {/* S'il y a au moins un produit actif, on anime ce tuyau */}
          {Object.keys(activeProducts).map((id) => {
            if (activeProducts[id]?.status !== "active") return null;
            const p = PRODUCTS.find((x) => x.id === id);
            if (!p) return null;
            return (
              <motion.div
                key={id}
                className="absolute inset-0 opacity-90"
                style={{
                  backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 6px, ${p.color} 6px, ${p.color} 12px)`,
                  boxShadow: `0 0 12px ${p.glow}`,
                }}
                animate={{ backgroundPosition: ["0px 0px", "0px 24px"] }}
                transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
              />
            );
          })}
        </div>
      </div>

      {/* Cuve Principale : MIXER T-01 */}
      <div className="relative z-20 mx-auto flex h-36 w-64 flex-col justify-end overflow-hidden rounded-b-2xl border-x-4 border-b-4 border-t-2 border-[#475569] bg-[#0f172a] shadow-2xl">
        {/* Grille technique de fond */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "16px 16px",
          }}
        />

        {/* Niveau de liquide dans le mixer */}
        <div className="relative flex h-[50%] w-full flex-col justify-end overflow-hidden bg-slate-900/50">
          <motion.div
            className="absolute inset-0 opacity-60 mix-blend-screen"
            style={{
              background: latest ? PRODUCTS.find((p) => p.id === latest.productId)?.color || "#3b82f6" : "#3b82f6",
            }}
            animate={{
              y: ["3%", "-3%", "3%"],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Vagues */}
          <motion.div
            className="h-full w-[200%] bg-gradient-to-t from-blue-900/60 to-transparent"
            animate={{ x: ["-50%", "0%"] }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
          />
        </div>

        {/* Moteur & Agitateur */}
        <div className="absolute left-1/2 top-0 flex h-full -translate-x-1/2 flex-col items-center">
          {/* Bloc Moteur */}
          <div className="flex h-6 w-10 items-center justify-center rounded-sm border border-zinc-600 bg-zinc-700 shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
            <Activity
              className={`h-4 w-4 ${
                Object.values(activeProducts).some((a) => a?.status === "active")
                  ? "text-cyan-400 opacity-100"
                  : "text-zinc-400 opacity-40"
              }`}
            />
          </div>
          {/* Arbre de transmission */}
          <div className="h-full w-2 bg-gradient-to-r from-zinc-500 to-zinc-300 shadow-inner" />
          {/* Pales de l'agitateur */}
          <motion.div
            className="absolute bottom-8 flex h-2 w-20 items-center justify-center rounded-full bg-gradient-to-b from-zinc-300 to-zinc-500 shadow-md"
            animate={{
              rotateY: Object.values(activeProducts).some((a) => a?.status === "active") ? [0, 360] : 0,
            }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute bottom-8 flex h-2 w-20 items-center justify-center rounded-full bg-gradient-to-b from-zinc-400 to-zinc-600 shadow-md"
            animate={{
              rotateY: Object.values(activeProducts).some((a) => a?.status === "active") ? [90, 450] : 90,
            }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          />
        </div>

        {/* Overlay d'informations */}
        <div className="absolute bottom-3 left-3 text-[11px] font-bold uppercase tracking-widest text-white/70">
          MIXER T-01
        </div>
        {latest && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md bg-black/60 px-3 py-1.5 text-xs font-bold text-[color:var(--color-cyan-neon)] backdrop-blur-sm border border-white/10">
            <Droplet className="h-4 w-4" />
            {latest.volume.toFixed(1)} L
          </div>
        )}
      </div>
    </div>
  );
}
