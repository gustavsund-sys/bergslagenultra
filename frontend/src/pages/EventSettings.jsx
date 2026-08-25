import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarClock, LogOut, Save } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { LOGO_URL, saveEventSettings, subscribeEventSettings } from "@/lib/api";
import { formatOpeningDate, getRegistrationStatus } from "@/hooks/useRegistrationStatus";

const toLocalInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const toIso = (value) => value ? new Date(value).toISOString() : null;

export default function EventSettings() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => subscribeEventSettings((settings) => setForm({
    registration_enabled: settings.registration_enabled,
    registration_open_at: toLocalInput(settings.registration_open_at),
    registration_close_at: toLocalInput(settings.registration_close_at),
    countdown_days: settings.countdown_days,
  })), []);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const save = async (event) => {
    event.preventDefault();
    const openAt = toIso(form.registration_open_at);
    const closeAt = toIso(form.registration_close_at);
    if (openAt && closeAt && new Date(closeAt) <= new Date(openAt)) {
      toast.error("Stängningstiden måste ligga efter öppningstiden.");
      return;
    }
    setSaving(true);
    try {
      await saveEventSettings({
        ...form,
        registration_open_at: openAt,
        registration_close_at: closeAt,
      });
      toast.success("Anmälningsinställningarna är sparade.");
    } catch (error) {
      toast.error(error.message || "Inställningarna kunde inte sparas.");
    } finally {
      setSaving(false);
    }
  };

  const doLogout = async () => { await logout(); navigate("/admin/login"); };
  const preview = form ? getRegistrationStatus({
    ...form,
    registration_open_at: toIso(form.registration_open_at),
    registration_close_at: toIso(form.registration_close_at),
  }) : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-brand-forest text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="inline-flex items-center gap-2 rounded-sm border border-white/20 px-3 py-2 text-xs font-bold uppercase tracking-wide hover:bg-white/10">
              <ArrowLeft size={15} /> Tillbaka
            </Link>
            <img src={LOGO_URL} alt="" className="hidden h-9 w-9 rounded-full bg-white object-contain p-1 sm:block" />
            <span className="font-display text-sm font-extrabold uppercase">Anmälningsinställningar</span>
          </div>
          <button onClick={doLogout} className="inline-flex items-center gap-2 rounded-sm border border-white/20 px-3 py-2 text-xs font-bold uppercase tracking-wide hover:bg-white/10">
            <LogOut size={15} /> <span className="hidden sm:inline">Logga ut</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <span className="text-sm font-bold uppercase tracking-[0.25em] text-brand">Funktionär</span>
        <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-tight text-brand-forest">Styr anmälan</h1>
        <p className="mt-2 text-sm text-muted-foreground">Inställningarna gäller omedelbart och kontrolleras även av databasens säkerhetsregler.</p>

        {!form ? <p className="mt-10 text-muted-foreground">Hämtar inställningar…</p> : (
          <form onSubmit={save} className="mt-8 space-y-6 rounded-md border border-border bg-white p-6 sm:p-8">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-brand-sand p-4">
              <input
                type="checkbox"
                checked={form.registration_enabled}
                onChange={(event) => set("registration_enabled", event.target.checked)}
                className="mt-0.5 h-5 w-5 accent-brand"
              />
              <span>
                <span className="block text-sm font-bold text-brand-forest">Aktivera anmälan</span>
                <span className="mt-1 block text-xs text-muted-foreground">Om ett framtida öppningsdatum anges blir anmälan aktiv först då. Avmarkera för att stänga manuellt.</span>
              </span>
            </label>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <Label htmlFor="registration-open" className="text-xs font-bold uppercase tracking-[0.16em]">Öppnar</Label>
                <Input id="registration-open" type="datetime-local" className="mt-2" value={form.registration_open_at} onChange={(event) => set("registration_open_at", event.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">Lämna tomt för att öppna direkt.</p>
              </div>
              <div>
                <Label htmlFor="registration-close" className="text-xs font-bold uppercase tracking-[0.16em]">Stänger</Label>
                <Input id="registration-close" type="datetime-local" className="mt-2" value={form.registration_close_at} onChange={(event) => set("registration_close_at", event.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">Valfritt. Lämna tomt för ingen automatisk stängning.</p>
              </div>
            </div>

            <div>
              <Label htmlFor="countdown-days" className="text-xs font-bold uppercase tracking-[0.16em]">Visa nedräkning antal dagar före öppning</Label>
              <Input id="countdown-days" type="number" min="0" max="365" className="mt-2 max-w-40" value={form.countdown_days} onChange={(event) => set("countdown_days", event.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">Ange 0 för att inte visa någon nedräkningsklocka.</p>
            </div>

            <div className="rounded-md border border-brand/30 bg-brand-sand p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-moss"><CalendarClock size={16} /> Aktuell status</div>
              <div className="mt-2 font-display text-xl font-black uppercase text-brand-forest">
                {preview?.phase === "open" ? "Öppen" : preview?.phase === "countdown" ? "Nedräkning visas" : preview?.phase === "scheduled" ? "Schemalagd" : "Stängd"}
              </div>
              {preview?.openAt && <div className="mt-1 text-sm text-muted-foreground">Öppnar {formatOpeningDate(preview.openAt)}</div>}
            </div>

            <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-brand px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-brand-hover disabled:opacity-60 sm:w-auto">
              <Save size={17} /> {saving ? "Sparar…" : "Spara inställningar"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
