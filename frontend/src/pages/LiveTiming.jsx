import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiErrorDetail, LOGO_URL } from "@/lib/api";
import { toast } from "sonner";
import { LogOut, ArrowLeft, Play, RotateCcw, Flag, X, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const fmt = (s) => {
  if (s == null) return "--:--:--";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const DISTANCES = ["6 km", "14 km", "47 km"];

export default function LiveTiming() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [timing, setTiming] = useState({});
  const [runners, setRunners] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [offset, setOffset] = useState(0); // server clock offset (ms): serverNow - clientNow
  const [armed, setArmed] = useState({}); // { bib: capturedSeconds }
  const savingRef = useRef({});

  const load = useCallback(async () => {
    try {
      const [t, r] = await Promise.all([
        api.get("/admin/timing"),
        api.get("/admin/registrations"),
      ]);
      const { server_now, ...dist } = t.data;
      if (server_now) setOffset(new Date(server_now).getTime() - Date.now());
      setTiming(dist);
      setRunners(r.data);
    } catch (e) {
      /* ignore */
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll every 10s so timing + finishes stay in sync across funktionärer/enheter
  useEffect(() => {
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const doLogout = async () => { await logout(); navigate("/admin/login"); };

  const elapsed = (d) => {
    const st = timing[d];
    if (!st) return null;
    return Math.max(0, Math.floor((now + offset - new Date(st).getTime()) / 1000));
  };

  const startDistance = async (d) => {
    if (timing[d] && !window.confirm(`${d} är redan startad. Vill du starta om tiden? Detta nollställer klockan.`)) return;
    try {
      const { data } = await api.post("/admin/timing/start", { distance: d });
      setTiming((prev) => ({ ...prev, [d]: data.start_time }));
      toast.success(`${d} startad!`);
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const resetDistance = async (d) => {
    if (!window.confirm(`Nollställa starttiden för ${d}? (Sparade sluttider påverkas inte.)`)) return;
    try {
      await api.post("/admin/timing/reset", { distance: d });
      setTiming((prev) => ({ ...prev, [d]: null }));
      setArmed((prev) => {
        const copy = { ...prev };
        runners.filter((r) => r.distance === d).forEach((r) => delete copy[r.bib_number]);
        return copy;
      });
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const resetAll = async () => {
    try {
      await api.post("/admin/timing/reset-all");
      setTiming({ "6 km": null, "14 km": null, "47 km": null });
      setArmed({});
      setRunners((prev) => prev.map((x) => ({ ...x, finish_time: null, finish_seconds: null })));
      toast.success("Tidtagningen är nollställd.");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const handleBibClick = async (r) => {
    const d = r.distance;
    if (!timing[d]) { toast.error(`Starta ${d} först.`); return; }
    const bib = r.bib_number;

    if (armed[bib] !== undefined) {
      // second click -> confirm & save
      if (savingRef.current[bib]) return;
      savingRef.current[bib] = true;
      const secs = armed[bib];
      try {
        await api.post("/admin/finish", { bib_number: bib, finish_time: fmt(secs) });
        toast.success(`Nr ${bib} · ${r.name} i mål på ${fmt(secs)}`);
        setArmed((prev) => { const c = { ...prev }; delete c[bib]; return c; });
        setRunners((prev) => prev.map((x) => (x.bib_number === bib ? { ...x, finish_time: fmt(secs), finish_seconds: secs } : x)));
      } catch (err) {
        toast.error(formatApiErrorDetail(err.response?.data?.detail));
      } finally {
        savingRef.current[bib] = false;
      }
    } else {
      // first click -> capture current elapsed
      const secs = elapsed(d);
      setArmed((prev) => ({ ...prev, [bib]: secs }));
    }
  };

  const cancelArm = (bib) => {
    setArmed((prev) => { const c = { ...prev }; delete c[bib]; return c; });
  };

  const removeFinish = async (r) => {
    if (!window.confirm(`Ångra målgång för nr ${r.bib_number} (${r.name})? Tiden tas bort från resultatlistan.`)) return;
    try {
      await api.delete(`/admin/finish/${r.bib_number}`);
      toast.success(`Målgång borttagen för nr ${r.bib_number}`);
      setRunners((prev) => prev.map((x) => (x.bib_number === r.bib_number ? { ...x, finish_time: null, finish_seconds: null } : x)));
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-brand-forest text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link to="/admin" data-testid="back-to-admin" title="Tillbaka" className="inline-flex shrink-0 items-center gap-2 rounded-sm border border-white/20 px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors hover:bg-white/10 sm:px-4">
              <ArrowLeft size={15} /> <span className="hidden sm:inline">Tillbaka</span>
            </Link>
            <img src={LOGO_URL} alt="" className="hidden h-9 w-9 shrink-0 rounded-full bg-white object-contain p-1 sm:block" />
            <div className="truncate font-display text-xs font-extrabold uppercase tracking-tight sm:text-sm">Live-tidtagning</div>
          </div>
          <button onClick={doLogout} data-testid="admin-logout" title="Logga ut" className="inline-flex shrink-0 items-center gap-2 rounded-sm border border-white/20 px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors hover:bg-white/10 sm:px-4">
            <LogOut size={15} /> <span className="hidden sm:inline">Logga ut</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="text-sm font-bold uppercase tracking-[0.25em] text-brand">Funktionär</span>
            <h1 className="mt-1 font-display text-3xl font-black uppercase tracking-tight text-brand-forest sm:text-4xl">Tidtagning</h1>
            <p className="mt-1 text-sm text-muted-foreground">Varje distans har sin egen starttid – starta dem var för sig nedan.</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                data-testid="reset-all-trigger"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-sm border border-destructive/40 bg-white px-5 py-3 text-xs font-bold uppercase tracking-wide text-destructive transition-colors hover:bg-destructive hover:text-white"
              >
                <RotateCcw size={16} /> Nollställ tidtagning
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent data-testid="reset-all-dialog">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="text-destructive" size={20} /> Nollställ hela tidtagningen?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Detta nollställer <span className="font-bold text-brand-forest">starttiderna för samtliga distanser</span> och raderar <span className="font-bold text-brand-forest">alla registrerade sluttider</span>. Deltagarna finns kvar, men all tidtagning börjar om från noll. Åtgärden går <span className="font-bold text-destructive">inte att ångra</span>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="reset-all-cancel">Avbryt</AlertDialogCancel>
                <AlertDialogAction
                  data-testid="reset-all-confirm"
                  onClick={resetAll}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  Ja, nollställ allt
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="mt-4 rounded-md border border-border bg-white p-4 text-sm text-muted-foreground">
          <span className="font-bold text-brand-forest">Så funkar det:</span> Starta distansen. Klicka på en löpares nummer <span className="font-bold text-brand">en gång</span> för att fånga tiden, och <span className="font-bold text-brand">en gång till</span> för att bekräfta målgången (dubbelklicka snabbt). Klickade du fel? Tryck på × uppe i hörnet av knappen för att ångra. Tider går att ändra i efterhand under "Deltagare & tider". <span className="font-bold text-brand-forest">Tiden körs i servern</span> – loggar en annan funktionär in visas samma klocka och sparade tider automatiskt.
        </div>

        <div className="mt-8 space-y-10">
          {DISTANCES.map((d) => {
            const list = runners.filter((r) => r.distance === d).sort((a, b) => a.bib_number - b.bib_number);
            const el = elapsed(d);
            const started = timing[d] != null;
            return (
              <section key={d} data-testid={`timing-section-${d.replace(" ", "")}`}>
                <div className="flex flex-col gap-3 rounded-md border border-border bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="font-display text-3xl font-black tracking-tighter text-brand-forest">{d}</div>
                    <div className={`font-mono text-2xl font-bold tabular-nums ${started ? "text-brand" : "text-muted-foreground/50"}`} data-testid={`clock-${d.replace(" ", "")}`}>
                      {started ? fmt(el) : "--:--:--"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startDistance(d)} data-testid={`start-${d.replace(" ", "")}`} className="inline-flex items-center gap-2 rounded-sm bg-brand-moss px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-forest">
                      <Play size={15} /> {started ? "Starta om" : "Starta"}
                    </button>
                    {started && (
                      <button onClick={() => resetDistance(d)} data-testid={`reset-${d.replace(" ", "")}`} className="inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-brand-forest transition-colors hover:bg-brand-sand">
                        <RotateCcw size={15} /> Nollställ
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {list.length === 0 ? (
                    <div className="col-span-full py-6 text-center text-muted-foreground">Inga anmälda på denna distans.</div>
                  ) : (
                    list.map((r) => {
                      const isArmed = armed[r.bib_number] !== undefined;
                      const isDone = !!r.finish_time && !isArmed;
                      const displayTime = isArmed ? fmt(armed[r.bib_number]) : isDone ? r.finish_time : started ? fmt(el) : "--:--:--";
                      const cls = isArmed
                        ? "border-brand bg-brand text-white ring-4 ring-brand/30 animate-pulse"
                        : isDone
                        ? "border-brand-moss bg-brand-moss text-white"
                        : "border-border bg-white text-brand-forest hover:border-brand";
                      return (
                        <div key={r.bib_number} className="relative">
                          {(isArmed || isDone) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); if (isArmed) { cancelArm(r.bib_number); } else { removeFinish(r); } }}
                              data-testid={`undo-bib-${r.bib_number}`}
                              title={isArmed ? "Avbryt" : "Ångra målgång"}
                              className="absolute -right-2 -top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-brand-forest text-white shadow-md transition-colors hover:bg-destructive"
                            >
                              <X size={17} />
                            </button>
                          )}
                          <button
                            onClick={() => handleBibClick(r)}
                            data-testid={`bib-btn-${r.bib_number}`}
                            className={`flex w-full min-h-[128px] flex-col items-center justify-center gap-1 rounded-md border-2 p-4 transition-all active:scale-95 ${cls}`}
                          >
                            <span className="font-display text-4xl font-black leading-none">{r.bib_number}</span>
                            <span className={`mt-1 truncate text-xs font-semibold ${isArmed || isDone ? "text-white/85" : "text-muted-foreground"}`}>{r.name.split(" ")[0]}</span>
                            <span className={`mt-1 font-mono text-sm font-bold tabular-nums ${isArmed || isDone ? "text-white" : "text-brand-forest"}`}>{displayTime}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider">
                              {isArmed ? "Bekräfta?" : isDone ? <span className="inline-flex items-center gap-1"><Flag size={11} /> I mål</span> : ""}
                            </span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
