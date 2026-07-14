/**
 * Sartex chemical products — mapped to the ISPSoft PLC ladder addresses
 * declared in Networks 27-34 of the trainee's dosing program.
 *
 * Each product corresponds to a memory bit (M100..M800) that triggers a
 * DMOV of the measured volume from a D-register (D102..D172) into an HMI
 * register (D200..D270) once the dose completes.
 */

export type ProductId =
  | "CHTT-AB35"
  | "FST-RW"
  | "JAVEL"
  | "VESASITAM"
  | "KAYA"
  | "HIDROFIL"
  | "SERTENZIN"
  | "DENIMCOL";

export interface ProductSpec {
  id: ProductId;
  name: string;
  usage: string;
  /** PLC memory bit (ISPSoft ladder network) */
  plcBit: string;
  /** PLC source register (measured volume) */
  plcSrc: string;
  /** PLC destination register (HMI display) */
  plcDst: string;
  /** Nominal target volume in litres for a standard batch */
  target: number;
  /** Nominal dose duration in seconds */
  baseDuration: number;
  /** Accent color hex — used by 3D scene, gauges, chart lines */
  color: string;
  glow: string;
}

export const PRODUCTS: readonly ProductSpec[] = [
  {
    id: "CHTT-AB35",
    name: "CHTT-AB35",
    usage: "Adoucissant cationique — main pour toucher denim",
    plcBit: "M100",
    plcSrc: "D102",
    plcDst: "D200",
    target: 42,
    baseDuration: 38,
    color: "#22d3ee",
    glow: "rgba(34,211,238,0.55)",
  },
  {
    id: "FST-RW",
    name: "FST RW",
    usage: "Séquestrant multi-métaux — bain préparatoire",
    plcBit: "M200",
    plcSrc: "D112",
    plcDst: "D210",
    target: 28,
    baseDuration: 32,
    color: "#60a5fa",
    glow: "rgba(96,165,250,0.55)",
  },
  {
    id: "JAVEL",
    name: "JAVEL",
    usage: "Hypochlorite — délavage indigo",
    plcBit: "M300",
    plcSrc: "D122",
    plcDst: "D220",
    target: 35,
    baseDuration: 30,
    color: "#a78bfa",
    glow: "rgba(167,139,250,0.55)",
  },
  {
    id: "VESASITAM",
    name: "VESASITAM",
    usage: "Mouillant anti-mousse — auxiliaire",
    plcBit: "M400",
    plcSrc: "D132",
    plcDst: "D230",
    target: 18,
    baseDuration: 22,
    color: "#f472b6",
    glow: "rgba(244,114,182,0.55)",
  },
  {
    id: "KAYA",
    name: "KAYA",
    usage: "Enzyme cellulase — bio-polissage denim",
    plcBit: "M500",
    plcSrc: "D142",
    plcDst: "D240",
    target: 25,
    baseDuration: 40,
    color: "#facc15",
    glow: "rgba(250,204,21,0.55)",
  },
  {
    id: "HIDROFIL",
    name: "Hidrofil",
    usage: "Hydrophilisant — absorption fibre",
    plcBit: "M600",
    plcSrc: "D152",
    plcDst: "D250",
    target: 32,
    baseDuration: 28,
    color: "#34d399",
    glow: "rgba(52,211,153,0.55)",
  },
  {
    id: "SERTENZIN",
    name: "SERTENZIN",
    usage: "Enzyme laccase — nuançage indigo",
    plcBit: "M700",
    plcSrc: "D162",
    plcDst: "D260",
    target: 22,
    baseDuration: 34,
    color: "#fb923c",
    glow: "rgba(251,146,60,0.55)",
  },
  {
    id: "DENIMCOL",
    name: "DENIMCOL",
    usage: "Fixateur couleur denim — post-traitement",
    plcBit: "M800",
    plcSrc: "D172",
    plcDst: "D270",
    target: 46,
    baseDuration: 44,
    color: "#f87171",
    glow: "rgba(248,113,113,0.55)",
  },
] as const;

export const PRODUCT_MAP: Record<ProductId, ProductSpec> = Object.fromEntries(
  PRODUCTS.map((p) => [p.id, p]),
) as Record<ProductId, ProductSpec>;
