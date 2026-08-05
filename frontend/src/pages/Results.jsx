import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/PublicLayout";
import { api } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trophy, Medal } from "lucide-react";

const RESULTS_HERO =
  "https://images.unsplash.com/photo-1667781838690-5f32ea0ccea6?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHw0fHxydW5uaW5nJTIwcmFjZSUyMGZpbmlzaCUyMGxpbmV8ZW58MHx8fHwxNzg1OTE4MDQ4fDA&ixlib=rb-4.1.0&q=85";

const rankStyle = (rank) => {
  if (rank === 1) return "text-[#B8860B]";
  if (rank === 2) return "text-[#8a8a8a]";
  if (rank === 3) return "text-[#a0672b]";
  return "text-brand-forest";
};

export default function Results() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/results").then((r) => setData(r.data)).catch(() => setData({ distances: [], groups: {} }));
  }, []);

  const distances = data?.distances || [];

  return (
    <PublicLayout>
      <section className="relative grain overflow-hidden">
        <img src={RESULTS_HERO} alt="Finish" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-brand-forest/70" />
        <div className="relative mx-auto max-w-5xl px-5 py-20 sm:px-8">
          <span className="text-sm font-bold uppercase tracking-[0.25em] text-brand">Bergslagsleden Ultra 2026</span>
          <h1 className="mt-3 flex items-center gap-3 font-display text-4xl font-black uppercase tracking-tighter text-white sm:text-5xl">
            <Trophy className="text-brand" size={40} /> Resultat
          </h1>
          <p className="mt-3 text-white/80">Slutresultat sorterat per distans och sluttid.</p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
        {data && (
          <Tabs defaultValue={distances[0]}>
            <TabsList className="bg-brand-sand" data-testid="results-tabs">
              {distances.map((d) => (
                <TabsTrigger key={d} value={d} data-testid={`results-tab-${d.replace(" ", "")}`} className="data-[state=active]:bg-brand data-[state=active]:text-white">
                  {d} <span className="ml-1.5 opacity-70">({data.groups[d]?.length || 0})</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {distances.map((d) => (
              <TabsContent key={d} value={d} className="mt-6">
                <div className="overflow-hidden rounded-md border border-border bg-white">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-brand-forest text-white">
                        <th className="px-4 py-3 font-bold uppercase tracking-wider">Plac.</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-wider">Nr</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-wider">Namn</th>
                        <th className="hidden px-4 py-3 font-bold uppercase tracking-wider sm:table-cell">Klubb</th>
                        <th className="px-4 py-3 text-right font-bold uppercase tracking-wider">Tid</th>
                      </tr>
                    </thead>
                    <tbody data-testid={`results-body-${d.replace(" ", "")}`}>
                      {(data.groups[d] || []).length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Inga resultat ännu.</td></tr>
                      ) : (
                        data.groups[d].map((r, i) => (
                          <tr key={r.bib_number} className={`${r.rank === 1 ? "bg-brand/10" : i % 2 ? "bg-brand-sand/40" : "bg-white"}`}>
                            <td className={`px-4 py-3 font-display text-lg font-black ${rankStyle(r.rank)}`}>
                              <span className="inline-flex items-center gap-1">
                                {r.rank <= 3 && <Medal size={16} className={rankStyle(r.rank)} />}
                                {r.rank}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-bold text-brand">{r.bib_number}</td>
                            <td className="px-4 py-3 font-semibold text-brand-forest">{r.name}</td>
                            <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{r.club}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-brand-forest">{r.finish_time}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </PublicLayout>
  );
}
