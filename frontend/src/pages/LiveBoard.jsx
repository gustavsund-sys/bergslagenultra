import { useEffect, useState } from "react";
import { LOGO_URL, publicData, subscribePublicRows } from "@/lib/api";
import { Trophy, Medal, Radio } from "lucide-react";

const rankColor = (rank) => {
  if (rank === 1) return "text-[#F5C542]";
  if (rank === 2) return "text-[#c9c9c9]";
  if (rank === 3) return "text-[#e08a4b]";
  return "text-white/80";
};

export default function LiveBoard() {
  const [data, setData] = useState(null);
  const [active, setActive] = useState(0);
  const [updated, setUpdated] = useState(null);

  useEffect(() => {
    return subscribePublicRows((rows) => {
      setData(publicData.groupResults(rows));
      setUpdated(new Date());
    });
  }, []);

  const distances = data?.distances || [];

  // auto-cycle distances every 12s
  useEffect(() => {
    if (distances.length === 0) return;
    const t = setInterval(() => setActive((a) => (a + 1) % distances.length), 12000);
    return () => clearInterval(t);
  }, [distances.length]);

  const current = distances[active];
  const rows = (data?.groups?.[current] || []).slice(0, 15);

  return (
    <div className="min-h-screen bg-brand-forest text-white grain">
      <div className="mx-auto max-w-6xl px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={LOGO_URL} alt="Logo" className="h-14 w-14 rounded-full bg-white object-contain p-1" />
            <div>
              <div className="font-display text-2xl font-black uppercase tracking-tight sm:text-3xl">Bergslagsleden Ultra</div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-brand">
                <Radio size={14} className="animate-pulse" /> Livetavla
              </div>
            </div>
          </div>
          {updated && (
            <div className="text-right text-xs text-white/50">
              Uppdaterad<br />{updated.toLocaleTimeString("sv-SE")}
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-wrap gap-3" data-testid="live-distance-tabs">
          {distances.map((d, i) => (
            <button key={d} onClick={() => setActive(i)}
              className={`rounded-sm px-5 py-2.5 text-sm font-bold uppercase tracking-wide transition-colors ${i === active ? "bg-brand text-white" : "bg-white/10 text-white/70 hover:bg-white/20"}`}>
              {d}
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Trophy className="text-brand" size={30} />
          <h1 className="font-display text-4xl font-black uppercase tracking-tighter sm:text-5xl">{current} · Resultat</h1>
        </div>

        <div className="mt-6 overflow-hidden rounded-md border border-white/10" data-testid="live-board">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/60">
                <th className="px-5 py-3">Plac.</th>
                <th className="px-5 py-3">Nr</th>
                <th className="px-5 py-3">Namn</th>
                <th className="hidden px-5 py-3 sm:table-cell">Klubb</th>
                <th className="px-5 py-3 text-right">Tid</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-16 text-center text-lg text-white/40">Inga målgångar ännu…</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.bib_number} className={`border-b border-white/5 ${r.rank === 1 ? "bg-brand/15" : ""}`}>
                    <td className={`px-5 py-4 font-display text-2xl font-black ${rankColor(r.rank)}`}>
                      <span className="inline-flex items-center gap-2">
                        {r.rank <= 3 && <Medal size={20} className={rankColor(r.rank)} />}
                        {r.rank}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xl font-bold text-brand">{r.bib_number}</td>
                    <td className="px-5 py-4 text-xl font-semibold">{r.name}</td>
                    <td className="hidden px-5 py-4 text-lg text-white/60 sm:table-cell">{r.club}</td>
                    <td className="px-5 py-4 text-right font-mono text-xl font-bold">{r.finish_time}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-center text-xs text-white/30">Tavlan uppdateras i realtid · distanser växlar var 12:e sekund</div>
      </div>
    </div>
  );
}
