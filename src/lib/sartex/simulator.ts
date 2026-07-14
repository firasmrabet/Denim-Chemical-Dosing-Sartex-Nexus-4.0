/**
 * Client-side dosing simulator.
 *
 * Simulates the Delta PLC dosing cycle described in the ISPSoft ladder:
 *   - Every ~5s a product bit fires (M100..M800)
 *   - The measured volume (D-register) is transferred to the HMI table
 *   - After timer T0/K10, the trigger resets (Network 36)
 *
 * The simulator also introduces two intentional patterns so the AI layer
 * has something meaningful to detect:
 *   1) occasional over-doses (~5% chance) — surfaced by Z-score
 *   2) a slow linear drift on dose *duration* (pump wear) — surfaced by
 *      the linear-regression maintenance model.
 *
 * When MODE === "real" the simulator holds; the `readModbusFrame()` stub
 * shows where to plug modbus-serial for the physical PLC.
 */

import { PRODUCTS, type ProductId } from "./products";

export type Mode = "simulation" | "real";

export interface DoseEvent {
  id: string;
  productId: ProductId;
  /** Litres measured for this batch */
  volume: number;
  /** Seconds elapsed between M-bit rising edge and reset */
  duration: number;
  /** Target volume that recipe requested */
  target: number;
  /** ms epoch */
  timestamp: number;
  /** True if this shot was intentionally injected as an anomaly */
  anomaly: boolean;
  batchId: string;
}

const STORAGE_KEY = "sartex.history.v1";
const MAX_STORED = 800;

function loadHistory(): DoseEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedHistory();
    const parsed = JSON.parse(raw) as DoseEvent[];
    return Array.isArray(parsed) ? parsed : seedHistory();
  } catch {
    return seedHistory();
  }
}

function persist(history: DoseEvent[]) {
  if (typeof window === "undefined") return;
  const trimmed = history.slice(-MAX_STORED);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

/** Deterministic gaussian via Box-Muller */
function gauss(mean: number, std: number): number {
  const u1 = Math.random() || 1e-9;
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

/** Seeds ~14 days of history so charts and AI have data on first load. */
function seedHistory(): DoseEvent[] {
  const now = Date.now();
  const events: DoseEvent[] = [];
  const daysBack = 14;
  for (let d = daysBack; d >= 0; d--) {
    // 30 dosing cycles per simulated day
    for (let i = 0; i < 30; i++) {
      const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
      const wearFactor = 1 + (daysBack - d) * 0.018; // pumps slowly degrade
      const anomaly = Math.random() < 0.04;
      const volume = anomaly
        ? product.target * (1.35 + Math.random() * 0.25)
        : Math.max(1, gauss(product.target, product.target * 0.06));
      const duration = Math.max(
        6,
        gauss(product.baseDuration * wearFactor, product.baseDuration * 0.05),
      );
      const dayStart = now - d * 86_400_000;
      const t = dayStart + i * (86_400_000 / 30);
      events.push({
        id: `${t}-${product.id}-${i}`,
        productId: product.id,
        volume: Number(volume.toFixed(2)),
        duration: Number(duration.toFixed(1)),
        target: product.target,
        timestamp: t,
        anomaly,
        batchId: `B-${String(Math.floor(t / 3_600_000) % 100000).padStart(5, "0")}`,
      });
    }
  }
  return events;
}

type Listener = (history: DoseEvent[], latest: DoseEvent | null) => void;

class SimulatorEngine {
  private history: DoseEvent[] = [];
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private mode: Mode = "simulation";
  private tickIndex = 0;

  init() {
    if (this.history.length === 0) {
      this.history = loadHistory();
    }
    this.start();
  }

  getHistory() {
    return this.history;
  }
  getMode() {
    return this.mode;
  }

  setMode(mode: Mode) {
    this.mode = mode;
    if (mode === "real") this.stop();
    else this.start();
    this.notify(null);
  }

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private notify(latest: DoseEvent | null) {
    for (const l of this.listeners) l(this.history, latest);
  }

  private start() {
    if (this.timer || this.mode !== "simulation") return;
    // 5s per dose cycle (matches T0 K10 → 1s in ISPSoft, we x5 for visual clarity)
    this.timer = setInterval(() => this.tick(), 5000);
  }

  private stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick() {
    // Cycle products for a natural rhythm; every 7th tick pick random
    const product =
      this.tickIndex % 7 === 6
        ? PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)]
        : PRODUCTS[this.tickIndex % PRODUCTS.length];
    this.tickIndex++;

    const anomaly = Math.random() < 0.06;
    const volume = anomaly
      ? product.target * (1.3 + Math.random() * 0.3)
      : Math.max(1, gauss(product.target, product.target * 0.055));
    // slow drift so linear regression detects wear
    const wear = 1 + this.tickIndex * 0.0009;
    const duration = Math.max(
      6,
      gauss(product.baseDuration * wear, product.baseDuration * 0.05),
    );
    const now = Date.now();
    const evt: DoseEvent = {
      id: `${now}-${product.id}`,
      productId: product.id,
      volume: Number(volume.toFixed(2)),
      duration: Number(duration.toFixed(1)),
      target: product.target,
      timestamp: now,
      anomaly,
      batchId: `B-${String(Math.floor(now / 3_600_000) % 100000).padStart(5, "0")}`,
    };
    this.history = [...this.history, evt];
    if (this.history.length > MAX_STORED) {
      this.history = this.history.slice(-MAX_STORED);
    }
    persist(this.history);
    this.notify(evt);
  }

  /**
   * MODBUS PLACEHOLDER — plug real hardware here.
   *
   *   import ModbusRTU from "modbus-serial";
   *   const client = new ModbusRTU();
   *   await client.connectRTUBuffered("/dev/ttyUSB0", { baudRate: 9600 });
   *   const { data } = await client.readHoldingRegisters(200, 8);
   *   // map data[0..7] to D200..D270 → PRODUCTS[0..7]
   *
   * In this web build (Cloudflare Worker runtime) modbus-serial cannot run
   * client-side; the "real" mode would forward to an on-site gateway.
   */
  readModbusFrame(): DoseEvent | null {
    return null;
  }
}

export const simulator = new SimulatorEngine();
