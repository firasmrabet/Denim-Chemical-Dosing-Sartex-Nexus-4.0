import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Activity, Brain, Database, Radio, Wifi, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { SartexLogo } from "./SartexLogo";
import type { Mode } from "@/lib/sartex/simulator";

const NAV = [
  { to: "/", label: "Monitoring", icon: Activity },
  { to: "/history", label: "History & Logs", icon: Database },
  { to: "/ai", label: "AI Analytics", icon: Brain },
] as const;

export function AppShell({
  children,
  mode,
  onToggleMode,
}: {
  children: ReactNode;
  mode: Mode;
  onToggleMode: (m: Mode) => void;
}) {
  const state = useRouterState();
  const pathname = state.location.pathname;
  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 grid-industrial opacity-40" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-40 bg-gradient-to-b from-[color:var(--color-cyan-neon)]/5 to-transparent" />

      <header className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl">
        <div className="glass mx-auto flex max-w-[1600px] items-center justify-between gap-6 px-6 py-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <SartexLogo className="h-9" />
              <div className="hidden h-8 w-px bg-white/10 md:block" />
              <div className="hidden md:block">
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  Denim Chemical Dosing
                </div>
                <div className="text-sm font-semibold">
                  Sartex <span className="text-gradient-cyan">Nexus 4.0</span>
                </div>
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="group relative rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span
                    className={`flex items-center gap-2 ${active ? "text-foreground" : ""}`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                  {active && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute inset-0 -z-10 rounded-lg bg-white/5 ring-1 ring-white/10"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs md:flex">
              <Radio className="ticker-dot h-3 w-3 text-[color:var(--color-cyan-neon)]" />
              <span className="tracking-widest text-muted-foreground">PLC</span>
              <span className="font-mono">DVP-32EH</span>
            </div>
            <ModeToggle mode={mode} onChange={onToggleMode} />
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 md:px-6 md:py-8">
        {children}
      </main>

      <footer className="relative mx-auto max-w-[1600px] px-6 pb-8 pt-4 text-[11px] text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-4">
          <span>
            © {new Date().getFullYear()} Sartex Group · Ksar Hellal, Monastir · PFE Édition
          </span>
          <span className="font-mono uppercase tracking-widest">
            Edge · SQLite · Modbus RTU · Socket.io
          </span>
        </div>
      </footer>
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const isSim = mode === "simulation";
  return (
    <button
      onClick={() => onChange(isSim ? "real" : "simulation")}
      className="relative flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 pr-3 text-xs transition-colors hover:bg-white/10"
      aria-label="Toggle mode"
    >
      <span className="relative flex h-7 w-14 items-center rounded-full bg-black/40">
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="absolute h-6 w-6 rounded-full"
          style={{
            left: isSim ? 2 : "calc(100% - 26px)",
            background: isSim
              ? "linear-gradient(135deg,#22d3ee,#60a5fa)"
              : "linear-gradient(135deg,#f472b6,#f87171)",
            boxShadow: isSim
              ? "0 0 18px rgba(34,211,238,0.6)"
              : "0 0 18px rgba(248,113,113,0.55)",
          }}
        />
      </span>
      <span className="flex items-center gap-1.5 font-semibold">
        {isSim ? (
          <>
            <WifiOff className="h-3.5 w-3.5" />
            <span>Simulation</span>
          </>
        ) : (
          <>
            <Wifi className="h-3.5 w-3.5" />
            <span>Live PLC</span>
          </>
        )}
      </span>
    </button>
  );
}
