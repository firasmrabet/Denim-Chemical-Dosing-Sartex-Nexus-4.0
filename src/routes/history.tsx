import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Download, Filter, Search, FileText } from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { AppShell } from "@/components/sartex/Layout";
import { PRODUCTS, PRODUCT_MAP, type ProductId } from "@/lib/sartex/products";
import { useSocket } from "@/hooks/useSocket";
import type { DoseEvent } from "@/lib/sartex/simulator";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Historique PLC · Sartex Nexus 4.0" },
      {
        name: "description",
        content:
          "Historique consolidé des dosages Sartex — filtres par produit et par date, export CSV, traçabilité batch complète.",
      },
    ],
  }),
  component: HistoryPage,
});

const PAGE_SIZE = 15;

function HistoryPage() {
  const { history, mode, setMode } = useSocket();
  const [productFilter, setProductFilter] = useState<ProductId | "all">("all");
  const [search, setSearch] = useState("");
  const [days, setDays] = useState<number>(7);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const cutoff = Date.now() - days * 86_400_000;
    const q = search.trim().toLowerCase();
    return [...history]
      .reverse()
      .filter((e) => e.timestamp >= cutoff)
      .filter((e) => (productFilter === "all" ? true : e.productId === productFilter))
      .filter((e) =>
        q
          ? e.batchId.toLowerCase().includes(q) ||
            PRODUCT_MAP[e.productId].name.toLowerCase().includes(q)
          : true,
      );
  }, [history, productFilter, days, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function exportCsv() {
    const BOM = "\uFEFF";
    const header = "Batch;Produit;Bit PLC;Source PLC;Dest PLC;Volume (L);Cible (L);Durée (s);Date et Heure;Statut";
    const lines = filtered.map((e: DoseEvent) => {
      const p = PRODUCT_MAP[e.productId];
      return [
        e.batchId,
        `"${p.name}"`,
        p.plcBit,
        p.plcSrc,
        p.plcDst,
        e.volume.toFixed(2).replace(".", ","),
        e.target.toString().replace(".", ","),
        e.duration.toFixed(1).replace(".", ","),
        `"${new Date(e.timestamp).toLocaleString("fr-FR")}"`,
        e.anomaly ? "Anomalie" : "OK",
      ].join(";");
    });
    const csv = BOM + [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Sartex_Historique_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Rapport d'Historique PLC - Sartex", 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Généré le : ${new Date().toLocaleString("fr-FR")}`, 14, 30);
    
    const tableColumn = ["Batch", "Produit", "PLC", "Volume", "Cible", "Durée", "Date", "Statut"];
    const tableRows = filtered.map((e) => {
      const p = PRODUCT_MAP[e.productId];
      return [
        e.batchId,
        p.name,
        `${p.plcBit} (${p.plcSrc} -> ${p.plcDst})`,
        `${e.volume.toFixed(2)} L`,
        `${e.target} L`,
        `${e.duration.toFixed(1)}s`,
        new Date(e.timestamp).toLocaleString("fr-FR"),
        e.anomaly ? "Anomalie" : "OK"
      ];
    });

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 250] },
      theme: "grid"
    });

    doc.save(`Sartex_Historique_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <AppShell mode={mode} onToggleMode={setMode}>
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Traçabilité
        </div>
        <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">
          Historique <span className="text-gradient-cyan">& Logs PLC</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Chaque batch est enregistré avec sa correspondance ISPSoft (M-bit, registres D
          source/destination) — conforme aux Networks 27-36 du programme ladder.
        </p>
      </div>

      {/* Filters */}
      <div className="card-industrial mb-4 flex flex-wrap items-center gap-3 p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span className="uppercase tracking-widest">Filtres</span>
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher batch, produit…"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-9 py-2 text-sm outline-none transition-colors focus:border-[color:var(--color-cyan-neon)]/60"
          />
        </div>
        <select
          value={productFilter}
          onChange={(e) => {
            setProductFilter(e.target.value as ProductId | "all");
            setPage(1);
          }}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[color:var(--color-cyan-neon)]/60"
        >
          <option value="all" className="bg-slate-900 text-white">Tous les produits</option>
          {PRODUCTS.map((p) => (
            <option key={p.id} value={p.id} className="bg-slate-900 text-white">
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={days}
          onChange={(e) => {
            setDays(Number(e.target.value));
            setPage(1);
          }}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[color:var(--color-cyan-neon)]/60"
        >
          <option value={1} className="bg-slate-900 text-white">Dernières 24h</option>
          <option value={3} className="bg-slate-900 text-white">3 jours</option>
          <option value={7} className="bg-slate-900 text-white">7 jours</option>
          <option value={14} className="bg-slate-900 text-white">14 jours</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            <Download className="h-4 w-4" />
            CSV
          </motion.button>
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={exportPdf}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[color:var(--color-cyan-neon)] to-[color:var(--color-blue-neon)] px-4 py-2 text-sm font-semibold text-black glow-cyan"
          >
            <FileText className="h-4 w-4" />
            Export PDF
          </motion.button>
        </div>
      </div>

      {/* Table */}
      <div className="card-industrial overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03]">
              <tr className="text-left text-xs uppercase tracking-widest text-white/70">
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Produit</th>
                <th className="px-4 py-3">PLC</th>
                <th className="px-4 py-3 text-right">Volume</th>
                <th className="px-4 py-3 text-right">Cible</th>
                <th className="px-4 py-3 text-right">Δ</th>
                <th className="px-4 py-3 text-right">Durée</th>
                <th className="px-4 py-3">Horodatage</th>
                <th className="px-4 py-3 text-right">État</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e, i) => {
                const p = PRODUCT_MAP[e.productId];
                const delta = e.volume - e.target;
                return (
                  <motion.tr
                    key={e.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.015 }}
                    className="border-b border-white/5 transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{e.batchId}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: p.color, boxShadow: `0 0 8px ${p.glow}` }}
                        />
                        <span className="font-semibold">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-white/80">
                      {p.plcBit} · {p.plcSrc}→{p.plcDst}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {e.volume.toFixed(2)} L
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      {e.target} L
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${
                        Math.abs(delta) > 3
                          ? "text-destructive"
                          : delta > 0
                            ? "text-[color:var(--color-warn)]"
                            : "text-muted-foreground"
                      }`}
                    >
                      {delta > 0 ? "+" : ""}
                      {delta.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{e.duration.toFixed(1)}s</td>
                    <td className="px-4 py-3 font-mono text-xs text-white/80">
                      {new Date(e.timestamp).toLocaleString("fr-FR", { hour12: false })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {e.anomaly ? (
                        <span className="inline-flex items-center rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-destructive">
                          Anomalie
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-[color:var(--color-ok)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[color:var(--color-ok)]">
                          OK
                        </span>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-sm text-muted-foreground">
                    Aucun batch pour ces critères.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 p-4 text-xs text-muted-foreground">
          <span>
            {filtered.length} batches · page {currentPage} / {pageCount}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-md border border-white/10 bg-white/5 px-3 py-1 disabled:opacity-40"
            >
              ← Précédent
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={currentPage === pageCount}
              className="rounded-md border border-white/10 bg-white/5 px-3 py-1 disabled:opacity-40"
            >
              Suivant →
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
