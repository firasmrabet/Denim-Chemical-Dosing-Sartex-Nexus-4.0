import { motion } from "framer-motion";
import type { ProductSpec } from "@/lib/sartex/products";

interface Props {
  product: ProductSpec;
  volume: number;
  active?: boolean;
  anomaly?: boolean;
}

export function CircularGauge({ product, volume, active, anomaly }: Props) {
  const pct = Math.max(0, Math.min(1, volume / product.target));
  const r = 46;
  const c = 2 * Math.PI * r;
  const dash = c * pct;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="card-industrial relative overflow-hidden p-4"
      style={
        anomaly
          ? { boxShadow: `0 0 0 1px rgba(248,113,113,0.55), 0 0 40px -6px rgba(248,113,113,0.55)` }
          : active
            ? { boxShadow: `0 0 0 1px ${product.glow}, 0 0 32px -6px ${product.glow}` }
            : undefined
      }
    >
      {/* subtle scanline gradient in the corner */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-40 blur-2xl"
        style={{ background: product.color }}
      />
      <div className="relative flex items-center gap-4">
        <div className="relative">
          <svg width={120} height={120} viewBox="0 0 120 120">
            <defs>
              <linearGradient id={`grad-${product.id}`} x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor={product.color} stopOpacity="1" />
                <stop offset="100%" stopColor={product.color} stopOpacity="0.4" />
              </linearGradient>
            </defs>
            <circle
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="8"
            />
            <motion.circle
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={`url(#grad-${product.id})`}
              strokeWidth="8"
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
              strokeDasharray={c}
              initial={{ strokeDashoffset: c }}
              animate={{ strokeDashoffset: c - dash }}
              transition={{ type: "spring", stiffness: 90, damping: 18 }}
              style={{ filter: `drop-shadow(0 0 6px ${product.glow})` }}
            />
            <text
              x="60"
              y="55"
              textAnchor="middle"
              className="fill-foreground"
              style={{ fontSize: 20, fontWeight: 700 }}
            >
              {volume.toFixed(1)}
            </text>
            <text
              x="60"
              y="74"
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 10, letterSpacing: 1.5 }}
            >
              L / {product.target}
            </text>
          </svg>
          {active && (
            <span className="live-dot absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[color:var(--color-cyan-neon)]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: product.color, boxShadow: `0 0 10px ${product.glow}` }}
            />
            <p className="truncate text-sm font-semibold tracking-wide">{product.name}</p>
          </div>
          <p className="mt-1 truncate text-[11px] leading-snug text-muted-foreground">
            {product.usage}
          </p>
          <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>{product.plcBit}</span>
            <span>
              {product.plcSrc} → {product.plcDst}
            </span>
          </div>
          {anomaly && (
            <div className="mt-2 rounded-md bg-destructive/20 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-destructive">
              Anomalie · Surdosage
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
