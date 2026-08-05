import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/PublicLayout";
import { api } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users } from "lucide-react";

export default function StartList() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/startlist").then((r) => setData(r.data)).catch(() => setData({ distances: [], groups: {} }));
  }, []);

  const distances = data?.distances || [];
  const total = distances.reduce((s, d) => s + (data?.groups?.[d]?.length || 0), 0);

  return (
    <PublicLayout>
      <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
        <span className="text-sm font-bold uppercase tracking-[0.25em] text-brand">Anmälda deltagare</span>
        <h1 className="mt-3 font-display text-4xl font-black uppercase tracking-tighter text-brand-forest sm:text-5xl">
          Startlista
        </h1>
        <p className="mt-3 flex items-center gap-2 text-muted-foreground">
          <Users size={18} className="text-brand" /> {total} anmälda deltagare totalt
        </p>

        {data && (
          <Tabs defaultValue={distances[0]} className="mt-10">
            <TabsList className="bg-brand-sand" data-testid="startlist-tabs">
              {distances.map((d) => (
                <TabsTrigger key={d} value={d} data-testid={`startlist-tab-${d.replace(" ", "")}`} className="data-[state=active]:bg-brand data-[state=active]:text-white">
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
                        <th className="px-4 py-3 font-bold uppercase tracking-wider">Nr</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-wider">Namn</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-wider">Klubb</th>
                        <th className="hidden px-4 py-3 font-bold uppercase tracking-wider sm:table-cell">Nation</th>
                      </tr>
                    </thead>
                    <tbody data-testid={`startlist-body-${d.replace(" ", "")}`}>
                      {(data.groups[d] || []).length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Inga anmälda ännu.</td></tr>
                      ) : (
                        data.groups[d].map((r, i) => (
                          <tr key={r.bib_number} className={i % 2 ? "bg-brand-sand/40" : "bg-white"}>
                            <td className="px-4 py-3 font-bold text-brand">{r.bib_number}</td>
                            <td className="px-4 py-3 font-semibold text-brand-forest">{r.name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{r.club}</td>
                            <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{r.nationality}</td>
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
