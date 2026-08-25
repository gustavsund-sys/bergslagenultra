import { useState } from "react";
import { PublicLayout } from "@/components/PublicLayout";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, Medal, Bus, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { RegistrationCountdown } from "@/components/RegistrationCountdown";
import { useRegistrationStatus } from "@/hooks/useRegistrationStatus";

const DISTANCES = [
  { v: "6 km", tag: "Kortdistans", note: "Ingen avgift" },
  { v: "14 km", tag: "Motion", note: "Ingen avgift" },
  { v: "47 km", tag: "Huvuddistans", note: "350 kr" },
];

const MEDAL_OPTS = [
  "JA - jag vill ha en medalj efter målgång.",
  "NEJ - jag vill att pengarna ska gå till Barndiabetesfonden.",
];
const BUS_OPTS = [
  "Ja, jag vill åka buss på morgonen (100kr/person)",
  "Nej, jag vill inte åka buss.",
];

export default function Register() {
  const { status } = useRegistrationStatus();
  const [form, setForm] = useState({
    name: "",
    birthdate: "",
    club: "",
    nationality: "Sweden",
    email: "",
    distance: "",
    medal: "",
    bus_transfer: "",
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const is47 = form.distance === "47 km";

  const submit = async (e) => {
    e.preventDefault();
    if (status?.phase !== "open") {
      toast.error("Anmälan är inte öppen.");
      return;
    }
    if (!form.name || !form.birthdate || !form.email || !form.distance || !form.nationality) {
      toast.error("Fyll i alla obligatoriska fält.");
      return;
    }
    if (is47 && (!form.medal || !form.bus_transfer)) {
      toast.error("Välj medalj- och busstillval för 47 km.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        birthdate: form.birthdate,
        club: form.club || "Klubblös",
        nationality: form.nationality,
        email: form.email,
        distance: form.distance,
        medal: is47 ? form.medal : null,
        bus_transfer: is47 ? form.bus_transfer : null,
      };
      const { data } = await api.post("/registrations", payload);
      setDone(data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Anmälan misslyckades.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-2xl px-5 py-24 sm:px-8" data-testid="registration-success">
          <div className="rounded-md border border-border bg-white p-10 text-center">
            <CheckCircle2 className="mx-auto text-brand-moss" size={54} />
            <h1 className="mt-5 font-display text-3xl font-black uppercase tracking-tight text-brand-forest">
              Anmälan bekräftad!
            </h1>
            <p className="mt-3 text-muted-foreground">
              Tack {done.name}! Din anmälan är sparad.
            </p>
            <div className="mx-auto mt-8 max-w-xs rounded-md border-2 border-brand bg-brand-sand p-6">
              <div className="text-xs font-bold uppercase tracking-[0.25em] text-brand-moss">Ditt deltagarnummer</div>
              <div className="mt-1 font-display text-6xl font-black text-brand" data-testid="success-bib-number">
                {done.bib_number}
              </div>
              <div className="mt-2 text-sm font-semibold text-brand-forest">{done.distance}</div>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Glöm inte att betala eventuell avgift via Swish 070-2417158.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Link to="/startlista" className="rounded-sm bg-brand px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-hover">
                Till startlistan
              </Link>
              <button
                onClick={() => { setDone(null); setForm({ name: "", birthdate: "", club: "", nationality: "Sweden", email: "", distance: "", medal: "", bus_transfer: "" }); }}
                className="rounded-sm border border-border px-6 py-3 text-sm font-bold uppercase tracking-wide text-brand-forest transition-colors hover:bg-brand-sand"
              >
                Anmäl fler
              </button>
            </div>
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (!status) {
    return <PublicLayout><div className="mx-auto max-w-2xl px-5 py-24 text-center text-muted-foreground">Kontrollerar anmälningsstatus…</div></PublicLayout>;
  }

  if (status.phase !== "open") {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-2xl px-5 py-24 sm:px-8">
          <RegistrationCountdown status={status} />
          <div className="mt-8 text-center">
            <h1 className="font-display text-3xl font-black uppercase tracking-tight text-brand-forest">
              {status.phase === "closed" ? "Anmälan är stängd" : "Anmälan har inte öppnat ännu"}
            </h1>
            <p className="mt-3 text-muted-foreground">Välkommen tillbaka när anmälan har öppnat.</p>
            <Link to="/" className="mt-7 inline-flex rounded-sm bg-brand px-6 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-brand-hover">Till startsidan</Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
        <span className="text-sm font-bold uppercase tracking-[0.25em] text-brand">Bergslagsleden Ultra 2026</span>
        <h1 className="mt-3 font-display text-4xl font-black uppercase tracking-tighter text-brand-forest sm:text-5xl">
          Anmälan
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Fyll i formuläret nedan. Du får ditt deltagarnummer direkt när anmälan har sparats.
        </p>

        <form onSubmit={submit} className="mt-10 space-y-8" data-testid="registration-form">
          {/* Distance selection */}
          <div>
            <div className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-brand-forest">Distans *</div>
            <div className="grid gap-3 sm:grid-cols-3">
              {DISTANCES.map((d) => (
                <button
                  key={d.v}
                  type="button"
                  data-testid={`select-distance-${d.v.replace(" ", "")}`}
                  onClick={() => set("distance", d.v)}
                  className={`rounded-md border p-5 text-left transition-all ${
                    form.distance === d.v
                      ? "border-brand ring-2 ring-brand"
                      : "border-border hover:border-brand/50"
                  }`}
                >
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">{d.tag}</div>
                  <div className="mt-1 font-display text-2xl font-black tracking-tight text-brand-forest">{d.v}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{d.note}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <Label htmlFor="name" className="text-xs font-bold uppercase tracking-[0.2em]">Namn (för- och efternamn) *</Label>
              <Input id="name" data-testid="input-name" className="mt-2" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Anna Andersson" />
            </div>
            <div>
              <Label htmlFor="birthdate" className="text-xs font-bold uppercase tracking-[0.2em]">Födelsedatum (ÅÅMMDD) *</Label>
              <Input id="birthdate" data-testid="input-birthdate" className="mt-2" value={form.birthdate} onChange={(e) => set("birthdate", e.target.value)} placeholder="830512" />
            </div>
            <div>
              <Label htmlFor="club" className="text-xs font-bold uppercase tracking-[0.2em]">Klubb / förening</Label>
              <Input id="club" data-testid="input-club" className="mt-2" value={form.club} onChange={(e) => set("club", e.target.value)} placeholder="Klubblös" />
            </div>
            <div>
              <Label htmlFor="nationality" className="text-xs font-bold uppercase tracking-[0.2em]">Nationalitet *</Label>
              <Input id="nationality" data-testid="input-nationality" className="mt-2" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} placeholder="Sweden" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-[0.2em]">E-post *</Label>
              <Input id="email" type="email" data-testid="input-email" className="mt-2" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="anna@exempel.se" />
            </div>
          </div>

          {/* Conditional 47km addons */}
          {is47 && (
            <div className="animate-fade-up space-y-6 rounded-md border border-border bg-brand-sand p-6" data-testid="addons-47km">
              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.15em] text-brand-forest">
                  <Medal size={16} className="text-brand" /> Medalj efter målgång *
                </div>
                <div className="space-y-2">
                  {MEDAL_OPTS.map((o) => (
                    <label key={o} className={`flex cursor-pointer items-center gap-3 rounded-sm border bg-white px-4 py-3 text-sm ${form.medal === o ? "border-brand" : "border-border"}`}>
                      <input type="radio" name="medal" checked={form.medal === o} onChange={() => set("medal", o)} className="accent-brand" data-testid={`medal-opt-${MEDAL_OPTS.indexOf(o)}`} />
                      {o}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.15em] text-brand-forest">
                  <Bus size={16} className="text-brand" /> Busstransfer Ånnaboda–Digerberget *
                </div>
                <div className="space-y-2">
                  {BUS_OPTS.map((o) => (
                    <label key={o} className={`flex cursor-pointer items-center gap-3 rounded-sm border bg-white px-4 py-3 text-sm ${form.bus_transfer === o ? "border-brand" : "border-border"}`}>
                      <input type="radio" name="bus" checked={form.bus_transfer === o} onChange={() => set("bus_transfer", o)} className="accent-brand" data-testid={`bus-opt-${BUS_OPTS.indexOf(o)}`} />
                      {o}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <p className="text-xs leading-relaxed text-muted-foreground">
            * Genom anmälan godkänner du att Föreningen Nature Running hanterar dina personuppgifter i
            enlighet med start-pm samt Svenska Friidrottsförbundets regler.
          </p>

          <button
            type="submit"
            disabled={loading}
            data-testid="register-submit-button"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-sm bg-brand px-7 py-4 text-sm font-bold uppercase tracking-wide text-white transition-all hover:-translate-y-0.5 hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {loading ? "Skickar…" : "Skicka anmälan"}
            {!loading && <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />}
          </button>
        </form>
      </div>
    </PublicLayout>
  );
}
