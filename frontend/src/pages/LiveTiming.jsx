import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiErrorDetail, LOGO_URL, subscribeAdminRows, subscribeTiming } from "@/lib/api";
import { toast } from "sonner";
import { LogOut, ArrowLeft, Play, Square, RotateCcw, Flag, X, AlertTriangle, UserX } from "lucide-react";
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
  const [armed, setArmed] = useState({}); // { bib: capturedSeconds }
  const [stopDialog, setStopDialog] = useState(null);
  const [markingRemaining, setMarkingRemaining] = useState(false);
  const armedRef = useRef({});
  const savingRef = useRef({});
  const stoppingRef = useRef({});

  useEffect(() => {
    const unsubscribeTiming = subscribeTiming(setTiming);
    const unsubscribeRunners = subscribeAdminRows(setRunners);
    return () => {
      unsubscribeTiming();
      unsubscribeRunners();
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const doLogout = async () => { await logout(); navigate("/admin/login"); };

  const elapsed = (d) => {
    const state = timing[d];
    if (!state?.start_time) return null;
    const end = state.stop_time ? new Date(state.stop_time).getTime() : now;
    return Math.max(0, Math.floor((end - new Date(state.start_time).getTime()) / 1000));
  };

  const isFinished = (runner) => !!runner.finish_time;
  const isDnf = (runner) => runner.race_status === "DNF";
  const isHandled = (runner) => isFinished(runner) || isDnf(runner);
  const remainingFor = (distance) => runners.filter((runner) => runner.distance === distance && !isHandled(runner));

  const startDistance = async (d) => {
    if (timing[d]?.start_time && !window.confirm(`${d} har redan en starttid. Vill du starta om tiden? Detta nollställer klockan.`)) return;
    try {
      const { data } = await api.post("/admin/timing/start", { distance: d });
      setTiming((prev) => ({ ...prev, [d]: data }));
      toast.success(`${d} startad!`);
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const stopDistance = async (d, automatic = false, confirmed = false) => {
    if (!timing[d]?.start_time || timing[d]?.stop_time || stoppingRef.current[d]) return;
    if (!automatic && !confirmed && !window.confirm(`Stoppa klockan för ${d}? Den stannar på den aktuella tiden.`)) return;
    stoppingRef.current[d] = true;
    try {
      const { data } = await api.post("/admin/timing/stop", { distance: d });
      setTiming((prev) => ({
        ...prev,
        [d]: prev[d] ? { ...prev[d], stop_time: data.stop_time } : prev[d],
      }));
      toast.success(automatic ? `${d} stoppad – alla deltagare är färdigbehandlade.` : `${d} stoppad.`);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      stoppingRef.current[d] = false;
    }
  };

  const resetDistance = async (d) => {
    try {
      await api.post("/admin/timing/reset", { distance: d });
      setTiming((prev) => ({ ...prev, [d]: null }));
      setArmed((prev) => {
        const copy = { ...prev };
        runners.filter((r) => r.distance === d).forEach((r) => delete copy[r.bib_number]);
        return copy;
      });
      runners.filter((r) => r.distance === d).forEach((r) => delete armedRef.current[r.bib_number]);
      setRunners((prev) => prev.map((x) => (x.distance === d ? { ...x, finish_time: null, finish_seconds: null, race_status: null } : x)));
      toast.success(`${d} nollställd.`);
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const resetAll = async () => {
    try {
      await api.post("/admin/timing/reset-all");
      setTiming({ "6 km": null, "14 km": null, "47 km": null });
      setArmed({});
      armedRef.current = {};
      setRunners((prev) => prev.map((x) => ({ ...x, finish_time: null, finish_seconds: null, race_status: null })));
      toast.success("Tidtagningen är nollställd.");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const handleBibClick = async (r) => {
    const d = r.distance;
    if (!timing[d]?.start_time) { toast.error(`Starta ${d} först.`); return; }
    if (timing[d]?.stop_time) { toast.error(`${d} är stoppad.`); return; }
    const bib = r.bib_number;
    if (isDnf(r)) { toast.error(`Nr ${bib} är markerad DNF.`); return; }
    if (r.finish_time && armedRef.current[bib] === undefined) {
      toast.info(`Nr ${bib} har redan tiden ${r.finish_time}. Ångra målgången först om den ska registreras igen.`);
      return;
    }

    if (armedRef.current[bib] !== undefined) {
      // second click -> confirm & save
      if (savingRef.current[bib]) return;
      savingRef.current[bib] = true;
      const secs = armedRef.current[bib];
      try {
        await api.post("/admin/finish", { bib_number: bib, finish_time: fmt(secs), prevent_overwrite: true });
        toast.success(`Nr ${bib} · ${r.name} i mål på ${fmt(secs)}`);
        delete armedRef.current[bib];
        setArmed((prev) => { const c = { ...prev }; delete c[bib]; return c; });
        setRunners((prev) => prev.map((x) => (x.bib_number === bib ? { ...x, finish_time: fmt(secs), finish_seconds: secs, race_status: null, finish_updated_at: new Date().toISOString() } : x)));
        const distanceRunners = runners.filter((runner) => runner.distance === d);
        const everyoneFinished = distanceRunners.length > 0
          && distanceRunners.every((runner) => runner.bib_number === bib || isHandled(runner));
        if (everyoneFinished) await stopDistance(d, true);
      } catch (err) {
        toast.error(formatApiErrorDetail(err.response?.data?.detail));
      } finally {
        savingRef.current[bib] = false;
      }
    } else {
      // first click -> capture current elapsed
      const secs = elapsed(d);
      armedRef.current[bib] = secs;
      setArmed((prev) => ({ ...prev, [bib]: secs }));
    }
  };

  const cancelArm = (bib) => {
    delete armedRef.current[bib];
    setArmed((prev) => { const c = { ...prev }; delete c[bib]; return c; });
  };

  const markDnf = async (r, confirm = true, silent = false) => {
    if (confirm && !window.confirm(`Markera nr ${r.bib_number} (${r.name}) som DNF? Eventuell måltid tas bort.`)) return false;
    if (savingRef.current[`dnf-${r.bib_number}`]) return false;
    savingRef.current[`dnf-${r.bib_number}`] = true;
    try {
      await api.post("/admin/status", { bib_number: r.bib_number, status: "DNF" });
      cancelArm(r.bib_number);
      setRunners((prev) => prev.map((runner) => runner.bib_number === r.bib_number
        ? { ...runner, race_status: "DNF", finish_time: null, finish_seconds: null, finish_updated_at: new Date().toISOString() }
        : runner));
      if (!silent) toast.success(`Nr ${r.bib_number} markerad DNF.`);
      const othersRemaining = remainingFor(r.distance).filter((runner) => runner.bib_number !== r.bib_number);
      if (!silent && othersRemaining.length === 0 && timing[r.distance]?.start_time && !timing[r.distance]?.stop_time) {
        await stopDistance(r.distance, true);
      }
      return true;
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
      return false;
    } finally {
      savingRef.current[`dnf-${r.bib_number}`] = false;
    }
  };

  const clearDnf = async (r) => {
    if (!window.confirm(`Ta bort DNF-markeringen för nr ${r.bib_number} (${r.name})?`)) return;
    try {
      await api.post("/admin/status", { bib_number: r.bib_number, status: null });
      setRunners((prev) => prev.map((runner) => runner.bib_number === r.bib_number
        ? { ...runner, race_status: null, finish_updated_at: new Date().toISOString() }
        : runner));
      toast.success(`DNF borttagen för nr ${r.bib_number}.`);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const requestStop = (distance) => {
    const remaining = remainingFor(distance);
    if (remaining.length === 0) stopDistance(distance);
    else setStopDialog(distance);
  };

  const markRemainingDnfAndStop = async () => {
    const distance = stopDialog;
    const remaining = remainingFor(distance);
    setMarkingRemaining(true);
    try {
      for (const runner of remaining) {
        const ok = await markDnf(runner, false, true);
        if (!ok) throw new Error(`Kunde inte markera nr ${runner.bib_number} som DNF.`);
      }
      setStopDialog(null);
      await stopDistance(distance, false, true);
    } catch (err) {
      toast.error(err.message || "Alla kvarvarande kunde inte markeras DNF.");
    } finally {
      setMarkingRemaining(false);
    }
  };

  const removeFinish = async (r) => {
    if (!window.confirm(`Ångra målgång för nr ${r.bib_number} (${r.name})? Tiden tas bort från resultatlistan.`)) return;
    try {
      await api.delete(`/admin/finish/${r.bib_number}`);
      toast.success(`Målgång borttagen för nr ${r.bib_number}`);
      setRunners((prev) => prev.map((x) => (x.bib_number === r.bib_number ? { ...x, finish_time: null, finish_seconds: null, finish_updated_at: new Date().toISOString() } : x)));
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
          <span className="font-bold text-brand-forest">Så funkar det:</span> Starta distansen. Klicka på en löpares nummer <span className="font-bold text-brand">en gång</span> för att fånga tiden, och <span className="font-bold text-brand">en gång till</span> för att bekräfta målgången (dubbelklicka snabbt). Klickade du fel? Tryck på × uppe i hörnet av knappen för att ångra. Klockan kan stoppas manuellt och stoppas automatiskt när alla på distansen är färdigbehandlade (i mål eller DNF). Tider går att ändra i efterhand under "Deltagare & tider". <span className="font-bold text-brand-forest">Start- och stopptid sparas med Firestores servertid</span> – andra funktionärer ser samma klocka och målgångar i realtid.
        </div>

        <div className="mt-8 space-y-10">
          {DISTANCES.map((d) => {
            const list = runners.filter((r) => r.distance === d).sort((a, b) => a.bib_number - b.bib_number);
            const el = elapsed(d);
            const started = !!timing[d]?.start_time;
            const stopped = !!timing[d]?.stop_time;
            const running = started && !stopped;
            const finishedCount = list.filter(isFinished).length;
            const dnfCount = list.filter(isDnf).length;
            const remaining = list.filter((runner) => !isHandled(runner));
            return (
              <section key={d} data-testid={`timing-section-${d.replace(" ", "")}`}>
                <div className="flex flex-col gap-3 rounded-md border border-border bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="font-display text-3xl font-black tracking-tighter text-brand-forest">{d}</div>
                    <div className={`font-mono text-2xl font-bold tabular-nums ${running ? "text-brand" : stopped ? "text-brand-forest" : "text-muted-foreground/50"}`} data-testid={`clock-${d.replace(" ", "")}`}>
                      {started ? fmt(el) : "--:--:--"}
                    </div>
                    {stopped && <span className="rounded-full bg-brand-forest/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-forest">Stoppad</span>}
                  </div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    {list.length} anmälda · {finishedCount} i mål · {remaining.length} kvar{dnfCount > 0 ? ` · ${dnfCount} DNF` : ""}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => startDistance(d)} data-testid={`start-${d.replace(" ", "")}`} className="inline-flex items-center gap-2 rounded-sm bg-brand-moss px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-forest">
                      <Play size={15} /> {started ? "Starta om" : "Starta"}
                    </button>
                    {running && (
                      <button onClick={() => requestStop(d)} data-testid={`stop-${d.replace(" ", "")}`} className="inline-flex items-center gap-2 rounded-sm bg-brand-forest px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand">
                        <Square size={14} /> Stoppa
                      </button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button data-testid={`reset-${d.replace(" ", "")}`} className="inline-flex items-center gap-2 rounded-sm border border-destructive/40 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-destructive transition-colors hover:bg-destructive hover:text-white">
                          <RotateCcw size={15} /> Nollställ
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent data-testid={`reset-${d.replace(" ", "")}-dialog`}>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="text-destructive" size={20} /> Nollställ {d}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Detta nollställer <span className="font-bold text-brand-forest">starttiden för {d}</span> och raderar <span className="font-bold text-brand-forest">sluttiderna för denna distans</span>. Övriga distanser påverkas inte. Åtgärden går <span className="font-bold text-destructive">inte att ångra</span>.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-testid={`reset-${d.replace(" ", "")}-cancel`}>Avbryt</AlertDialogCancel>
                          <AlertDialogAction data-testid={`reset-${d.replace(" ", "")}-confirm`} onClick={() => resetDistance(d)} className="bg-destructive text-white hover:bg-destructive/90">
                            Ja, nollställ {d}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {list.length === 0 ? (
                    <div className="col-span-full py-6 text-center text-muted-foreground">Inga anmälda på denna distans.</div>
                  ) : (
                    list.map((r) => {
                      const isArmed = armed[r.bib_number] !== undefined;
                      const isDone = !!r.finish_time && !isArmed;
                      const runnerIsDnf = isDnf(r) && !isArmed;
                      const displayTime = isArmed ? fmt(armed[r.bib_number]) : isDone ? r.finish_time : runnerIsDnf ? "DNF" : started ? fmt(el) : "--:--:--";
                      const cls = isArmed
                        ? "border-brand bg-brand text-white ring-4 ring-brand/30 animate-pulse"
                        : isDone
                        ? "border-brand-moss bg-brand-moss text-white"
                        : runnerIsDnf
                        ? "border-slate-400 bg-slate-500 text-white"
                        : "border-border bg-white text-brand-forest hover:border-brand";
                      return (
                        <div key={r.bib_number} className="relative">
                          {(isArmed || isDone || runnerIsDnf) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isArmed) cancelArm(r.bib_number);
                                else if (runnerIsDnf) clearDnf(r);
                                else removeFinish(r);
                              }}
                              data-testid={`undo-bib-${r.bib_number}`}
                              title={isArmed ? "Avbryt" : runnerIsDnf ? "Ta bort DNF" : "Ångra målgång"}
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
                            <span className={`mt-1 truncate text-xs font-semibold ${isArmed || isDone || runnerIsDnf ? "text-white/85" : "text-muted-foreground"}`}>{r.name.split(" ")[0]}</span>
                            <span className={`mt-1 font-mono text-sm font-bold tabular-nums ${isArmed || isDone || runnerIsDnf ? "text-white" : "text-brand-forest"}`}>{displayTime}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider">
                              {isArmed ? "Bekräfta?" : isDone ? <span className="inline-flex items-center gap-1"><Flag size={11} /> I mål</span> : runnerIsDnf ? <span className="inline-flex items-center gap-1"><UserX size={11} /> Brutit</span> : ""}
                            </span>
                          </button>
                          {running && !isArmed && !isDone && !runnerIsDnf && (
                            <button
                              onClick={(e) => { e.stopPropagation(); markDnf(r); }}
                              data-testid={`dnf-bib-${r.bib_number}`}
                              className="absolute bottom-2 right-2 z-10 rounded-sm border border-slate-300 bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600 shadow-sm hover:bg-slate-600 hover:text-white"
                            >
                              DNF
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-4 rounded-md border border-border bg-white p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-brand-forest">Kvar i loppet · {remaining.length}</div>
                  {remaining.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">Alla deltagare är färdigbehandlade.</p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2" data-testid={`remaining-${d.replace(" ", "")}`}>
                      {remaining.map((runner) => (
                        <span key={runner.bib_number} className="rounded-full bg-brand-sand px-3 py-1.5 text-xs font-semibold text-brand-forest">
                          Nr {runner.bib_number} · {runner.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <AlertDialog open={!!stopDialog} onOpenChange={(open) => { if (!open && !markingRemaining) setStopDialog(null); }}>
          <AlertDialogContent data-testid="stop-with-remaining-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="text-brand" size={20} /> Deltagare saknar sluttid
              </AlertDialogTitle>
              <AlertDialogDescription>
                {stopDialog && `${remainingFor(stopDialog).length} deltagare på ${stopDialog} är fortfarande kvar i loppet. Du kan gå tillbaka, stoppa ändå eller markera samtliga kvarvarande som DNF och därefter stoppa klockan.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {stopDialog && (
              <div className="max-h-40 overflow-y-auto rounded-sm bg-brand-sand p-3 text-sm text-brand-forest">
                {remainingFor(stopDialog).map((runner) => <div key={runner.bib_number}>Nr {runner.bib_number} · {runner.name}</div>)}
              </div>
            )}
            <AlertDialogFooter className="sm:flex-wrap">
              <AlertDialogCancel disabled={markingRemaining}>Avbryt</AlertDialogCancel>
              <AlertDialogAction
                disabled={markingRemaining}
                onClick={() => { const distance = stopDialog; setStopDialog(null); stopDistance(distance, false, true); }}
                className="bg-slate-600 text-white hover:bg-slate-700"
              >
                Stoppa ändå
              </AlertDialogAction>
              <button
                type="button"
                disabled={markingRemaining}
                onClick={markRemainingDnfAndStop}
                className="inline-flex items-center justify-center rounded-sm bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-hover disabled:opacity-60"
              >
                {markingRemaining ? "Markerar…" : "Markera kvarvarande DNF och stoppa"}
              </button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
