import { Link } from "react-router-dom";
import { PublicLayout } from "@/components/PublicLayout";
import { ArrowRight, Mountain, Heart, Route, Medal, Bus } from "lucide-react";

const HERO =
  "https://images.unsplash.com/photo-1644293230796-739c37cf4ffd?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2ODh8MHwxfHNlYXJjaHw0fHx0cmFpbCUyMHJ1bm5pbmclMjBmb3Jlc3R8ZW58MHx8fHwxNzg1OTE4MDQ4fDA&ixlib=rb-4.1.0&q=85";
const FOREST =
  "https://images.unsplash.com/photo-1634145365165-3ac2cfdf1cf5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NjZ8MHwxfHNlYXJjaHwyfHxzd2VkaXNoJTIwZm9yZXN0JTIwcnVubmluZ3xlbnwwfHx8fDE3ODU5MTgwNDh8MA&ixlib=rb-4.1.0&q=85";

const distances = [
  {
    km: "47 km",
    tag: "Huvuddistans",
    desc: "Anmälningsavgift 350 kr. Ingår startnummer, tidtagning, tre vätske- och energistationer, medalj och dusch.",
    span: "sm:col-span-2 sm:row-span-2",
    big: true,
  },
  { km: "14 km", tag: "Motionsdistans", desc: "Ingen anmälningsavgift. Skänk gärna en slant till Barndiabetesfonden." },
  { km: "6 km", tag: "Kortdistans", desc: "Ingen anmälningsavgift. Perfekt för nybörjare och familjen." },
];

export default function Landing() {
  return (
    <PublicLayout>
      {/* HERO */}
      <section className="relative grain overflow-hidden" data-testid="hero-section">
        <img src={HERO} alt="Trail" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-brand-forest/55" />
        <div className="relative mx-auto flex min-h-[78vh] max-w-7xl flex-col justify-center px-5 py-24 sm:px-8">
          <div className="animate-fade-up">
            <span className="inline-block rounded-sm bg-brand px-3 py-1.5 text-xs font-bold uppercase tracking-[0.25em] text-white">
              12 september 2026
            </span>
            <h1 className="mt-6 max-w-4xl font-display text-5xl font-black uppercase leading-[0.95] tracking-tighter text-white sm:text-7xl lg:text-8xl">
              Bergslagsleden<br />Ultra
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/85">
              Traillöpning genom Bergslagens djupa skogar mellan Digerberget och Ånnaboda.
              Du behöver inte åka till fjällen för att få höjdmetrarna.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                to="/anmalan"
                data-testid="hero-register-btn"
                className="group inline-flex items-center gap-2 rounded-sm bg-brand px-7 py-4 text-sm font-bold uppercase tracking-wide text-white shadow-[4px_4px_0px_rgba(26,36,33,0.6)] transition-all hover:-translate-y-0.5 hover:bg-brand-hover"
              >
                Anmäl dig nu
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/startlista"
                className="inline-flex items-center rounded-sm border border-white/40 bg-white/5 px-7 py-4 text-sm font-bold uppercase tracking-wide text-white backdrop-blur-sm transition-colors hover:bg-white/15"
              >
                Se startlistan
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-b border-border bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-border sm:grid-cols-4">
          {[
            { icon: Route, v: "3", l: "Distanser" },
            { icon: Mountain, v: "47 km", l: "Huvuddistans" },
            { icon: Medal, v: "1000+", l: "Höjdmeter" },
            { icon: Heart, v: "100%", l: "Till välgörenhet" },
          ].map((s, i) => (
            <div key={i} className="flex flex-col items-center bg-white px-4 py-10 text-center">
              <s.icon className="text-brand" size={26} />
              <div className="mt-3 font-display text-3xl font-black tracking-tight text-brand-forest">{s.v}</div>
              <div className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* DISTANCES BENTO */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8" data-testid="distances-section">
        <div className="max-w-2xl">
          <span className="text-sm font-bold uppercase tracking-[0.25em] text-brand">Välj din utmaning</span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-brand-forest sm:text-4xl">
            Tre distanser, en skog
          </h2>
        </div>
        <div className="mt-10 grid auto-rows-[minmax(180px,auto)] gap-4 sm:grid-cols-3">
          {distances.map((d) => (
            <div
              key={d.km}
              data-testid={`distance-card-${d.km.replace(" ", "")}`}
              className={`group relative flex flex-col justify-between rounded-md border border-border bg-white p-7 transition-all hover:border-brand ${d.span || ""}`}
            >
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand">{d.tag}</span>
                <div className={`mt-2 font-display font-black tracking-tighter text-brand-forest ${d.big ? "text-6xl sm:text-7xl" : "text-4xl"}`}>
                  {d.km}
                </div>
              </div>
              <p className={`mt-4 leading-relaxed text-muted-foreground ${d.big ? "max-w-md text-base" : "text-sm"}`}>
                {d.desc}
              </p>
              {d.big && (
                <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-brand-moss">
                  <span className="inline-flex items-center gap-1.5 rounded-sm bg-brand-sand px-3 py-1.5"><Medal size={14} /> Medalj</span>
                  <span className="inline-flex items-center gap-1.5 rounded-sm bg-brand-sand px-3 py-1.5"><Bus size={14} /> Busstransfer</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CHARITY */}
      <section className="relative grain overflow-hidden">
        <img src={FOREST} alt="Forest" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-brand-forest/80" />
        <div className="relative mx-auto max-w-3xl px-5 py-24 text-center sm:px-8">
          <Heart className="mx-auto text-brand" size={34} />
          <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Vi springer för Barndiabetesfonden
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-white/80">
            Allt överskott går oavkortat till Barndiabetesfonden. Genom att anmäla dig är du med och
            gör skillnad – varje kilometer räknas.
          </p>
          <Link
            to="/anmalan"
            className="mt-9 inline-flex items-center gap-2 rounded-sm bg-brand px-7 py-4 text-sm font-bold uppercase tracking-wide text-white transition-all hover:-translate-y-0.5 hover:bg-brand-hover"
          >
            Var med och bidra
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
