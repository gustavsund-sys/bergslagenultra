import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, LOGO_URL } from "@/lib/api";
import { Printer, ArrowLeft } from "lucide-react";

export default function BibLabels() {
  const [regs, setRegs] = useState([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api.get("/admin/registrations").then((r) => setRegs(r.data)).catch(() => setRegs([]));
  }, []);

  const filtered = regs.filter((r) => filter === "all" || r.distance === filter);

  return (
    <div className="min-h-screen bg-background">
      <header className="no-print sticky top-0 z-40 border-b border-border bg-brand-forest text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <Link to="/admin" data-testid="back-to-admin" className="inline-flex items-center gap-2 rounded-sm border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors hover:bg-white/10">
              <ArrowLeft size={15} /> Tillbaka
            </Link>
            <div className="font-display text-sm font-extrabold uppercase tracking-tight">Startnummerlappar</div>
          </div>
          <div className="flex items-center gap-2">
            {["all", "6 km", "14 km", "47 km"].map((f) => (
              <button key={f} onClick={() => setFilter(f)} data-testid={`bib-filter-${f.replace(" ", "")}`}
                className={`rounded-sm px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${filter === f ? "bg-brand text-white" : "border border-white/20 hover:bg-white/10"}`}>
                {f === "all" ? "Alla" : f}
              </button>
            ))}
            <button onClick={() => window.print()} data-testid="print-bibs" className="inline-flex items-center gap-2 rounded-sm bg-brand px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors hover:bg-brand-hover">
              <Printer size={15} /> Skriv ut
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 print-area">
        <p className="no-print mb-6 text-sm text-muted-foreground">
          {filtered.length} startnummerlappar. Använd knappen "Skriv ut" och välj skrivare eller "Spara som PDF".
        </p>
        {filtered.length === 0 ? (
          <p className="text-muted-foreground">Inga anmälningar att skriva ut.</p>
        ) : (
          <div className="bib-grid" data-testid="bib-grid">
            {filtered.map((r) => (
              <div key={r.bib_number} className="bib-card flex items-center justify-between border-2 border-brand-forest bg-white p-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <img src={LOGO_URL} alt="" className="h-7 w-7 object-contain" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand">Bergslagsleden Ultra</span>
                  </div>
                  <div className="mt-2 truncate font-display text-xl font-black uppercase tracking-tight text-brand-forest">{r.name}</div>
                  <div className="truncate text-sm text-muted-foreground">{r.club}</div>
                  <div className="mt-1 inline-block rounded-sm bg-brand-sand px-2 py-0.5 text-xs font-bold text-brand-moss">{r.distance}</div>
                </div>
                <div className="ml-4 shrink-0 text-center">
                  <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Nr</div>
                  <div className="font-display text-5xl font-black leading-none text-brand">{r.bib_number}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
