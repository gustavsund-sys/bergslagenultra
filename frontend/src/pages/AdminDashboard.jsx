import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiErrorDetail, LOGO_URL, subscribeAdminRows, syncResultSummaries } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogOut, Search, Timer, CheckCircle2, Trash2, Clock, Tag, Monitor, Pencil, Check, X, Bus, SlidersHorizontal } from "lucide-react";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [bib, setBib] = useState("");
  const [time, setTime] = useState("");
  const [lookup, setLookup] = useState(null);
  const [saving, setSaving] = useState(false);
  const [regs, setRegs] = useState([]);
  const [filter, setFilter] = useState("all");
  const [editBib, setEditBib] = useState(null);
  const [editTime, setEditTime] = useState("");
  const resultSummariesInitializedRef = useRef(false);

  const loadRegs = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/registrations");
      setRegs(data);
    } catch (e) {
      /* ignore */
    }
  }, []);

  useEffect(() => subscribeAdminRows((rows) => {
    setRegs(rows);
    if (!resultSummariesInitializedRef.current) {
      resultSummariesInitializedRef.current = true;
      syncResultSummaries(rows).catch(() => {
        resultSummariesInitializedRef.current = false;
      });
    }
  }), []);

  const doLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  const doLookup = async (b) => {
    const num = parseInt(b ?? bib, 10);
    if (!num) return;
    try {
      const { data } = await api.get(`/admin/lookup/${num}`);
      setLookup(data);
      if (data.finish_time) setTime(data.finish_time);
    } catch (err) {
      setLookup(null);
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const saveTime = async (e) => {
    e.preventDefault();
    const num = parseInt(bib, 10);
    if (!num || !time) {
      toast.error("Ange deltagarnummer och sluttid.");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/admin/finish", { bib_number: num, finish_time: time });
      toast.success(`Tid sparad för ${data.name} (${data.finish_time})`);
      setLookup(data);
      setBib(""); setTime(""); setLookup(null);
      loadRegs();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const clearTime = async (bibNum) => {
    try {
      await api.delete(`/admin/finish/${bibNum}`);
      toast.success("Tid rensad");
      loadRegs();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const takesBus = (r) => typeof r.bus_transfer === "string" && r.bus_transfer.trim().toLowerCase().startsWith("ja");

  const togglePaid = async (r) => {
    const next = !r.paid;
    setRegs((prev) => prev.map((x) => (x.bib_number === r.bib_number ? { ...x, paid: next } : x)));
    try {
      await api.post(`/admin/registrations/${r.bib_number}/paid`, { paid: next });
    } catch (err) {
      setRegs((prev) => prev.map((x) => (x.bib_number === r.bib_number ? { ...x, paid: !next } : x)));
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const startEdit = (r) => { setEditBib(r.bib_number); setEditTime(r.finish_time || ""); };
  const cancelEdit = () => { setEditBib(null); setEditTime(""); };
  const saveEdit = async (bibNum) => {
    if (!editTime.trim()) { await clearTime(bibNum); cancelEdit(); return; }
    try {
      await api.post("/admin/finish", { bib_number: bibNum, finish_time: editTime.trim() });
      toast.success("Tid uppdaterad");
      cancelEdit();
      loadRegs();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const filtered = regs.filter((r) => filter === "all" || r.distance === filter);
  const withTime = regs.filter((r) => r.finish_time).length;

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-brand-forest text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img src={LOGO_URL} alt="Logo" className="h-9 w-9 shrink-0 rounded-full bg-white object-contain p-1 sm:h-10 sm:w-10" />
            <div className="min-w-0">
              <div className="truncate font-display text-xs font-extrabold uppercase tracking-tight sm:text-sm">Funktionärspanel</div>
              <div className="truncate text-[11px] text-white/50">{user?.email}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link to="/admin/timing" data-testid="nav-timing" title="Tidtagning" className="inline-flex items-center gap-2 rounded-sm border border-white/20 px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors hover:bg-white/10 sm:px-4">
              <Timer size={15} /> <span className="hidden sm:inline">Tidtagning</span>
            </Link>
            <Link to="/admin/startnummer" data-testid="nav-startnummer" title="Startnummer" className="inline-flex items-center gap-2 rounded-sm border border-white/20 px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors hover:bg-white/10 sm:px-4">
              <Tag size={15} /> <span className="hidden sm:inline">Startnummer</span>
            </Link>
            <Link to="/admin/installningar" data-testid="nav-event-settings" title="Anmälningsinställningar" className="inline-flex items-center gap-2 rounded-sm border border-white/20 px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors hover:bg-white/10 sm:px-4">
              <SlidersHorizontal size={15} /> <span className="hidden sm:inline">Anmälan</span>
            </Link>
            <a href="#/live" target="_blank" rel="noreferrer" data-testid="nav-live" title="Livetavla" className="inline-flex items-center gap-2 rounded-sm border border-white/20 px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors hover:bg-white/10 sm:px-4">
              <Monitor size={15} /> <span className="hidden sm:inline">Livetavla</span>
            </a>
            <button onClick={doLogout} data-testid="admin-logout" title="Logga ut" className="inline-flex items-center gap-2 rounded-sm border border-white/20 px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors hover:bg-white/10 sm:px-4">
              <LogOut size={15} /> <span className="hidden sm:inline">Logga ut</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
          {/* Time entry */}
          <div className="min-w-0">
            <div className="rounded-md border border-border bg-white p-6">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-brand-forest">
                <Timer size={18} className="text-brand" /> Registrera sluttid
              </div>
              <form onSubmit={saveTime} className="mt-6 space-y-4" data-testid="finish-time-form">
                <div>
                  <Label htmlFor="bib" className="text-xs font-bold uppercase tracking-[0.2em]">Deltagarnummer</Label>
                  <div className="mt-2 flex min-w-0 gap-2">
                    <Input
                      id="bib" type="number" data-testid="input-bib" value={bib}
                      onChange={(e) => { setBib(e.target.value); setLookup(null); }}
                      onBlur={() => bib && doLookup()}
                      placeholder="t.ex. 12"
                      className="min-w-0 flex-1"
                    />
                    <button type="button" onClick={() => doLookup()} data-testid="lookup-bib" className="inline-flex shrink-0 items-center rounded-sm bg-brand-forest px-4 text-white transition-colors hover:bg-brand-moss">
                      <Search size={18} />
                    </button>
                  </div>
                </div>

                {lookup && (
                  <div className="animate-fade-up rounded-sm border border-brand bg-brand-sand px-4 py-3" data-testid="lookup-result">
                    <div className="font-display text-lg font-black text-brand-forest">{lookup.name}</div>
                    <div className="text-sm text-muted-foreground">{lookup.club} · {lookup.distance}</div>
                    {lookup.finish_time && (
                      <div className="mt-1 text-xs font-bold text-brand">Nuvarande tid: {lookup.finish_time}</div>
                    )}
                  </div>
                )}

                <div>
                  <Label htmlFor="time" className="text-xs font-bold uppercase tracking-[0.2em]">Sluttid (TT:MM:SS)</Label>
                  <Input id="time" data-testid="input-time" className="mt-2 font-mono" value={time} onChange={(e) => setTime(e.target.value)} placeholder="04:12:33" />
                </div>

                <button type="submit" disabled={saving} data-testid="admin-time-submit" className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-brand px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-all hover:-translate-y-0.5 hover:bg-brand-hover disabled:opacity-60">
                  <CheckCircle2 size={18} /> {saving ? "Sparar…" : "Spara tid"}
                </button>
              </form>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-md border border-border bg-white p-5">
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Anmälda</div>
                <div className="mt-1 font-display text-3xl font-black text-brand-forest">{regs.length}</div>
              </div>
              <div className="rounded-md border border-border bg-white p-5">
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">I mål</div>
                <div className="mt-1 font-display text-3xl font-black text-brand">{withTime}</div>
              </div>
            </div>
          </div>

          {/* Participants table */}
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-bold uppercase tracking-[0.2em] text-brand-forest">Deltagare &amp; tider</div>
              <div className="flex flex-wrap items-center gap-2">
              {["all", "6 km", "14 km", "47 km"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  data-testid={`filter-${f.replace(" ", "")}`}
                  className={`rounded-sm px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${filter === f ? "bg-brand text-white" : "border border-border bg-white text-brand-forest hover:bg-brand-sand"}`}
                >
                  {f === "all" ? "Alla" : f}
                </button>
              ))}
              </div>
            </div>
            <div className="overflow-x-auto rounded-md border border-border bg-white">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-brand-forest text-white">
                    <th className="px-4 py-3 font-bold uppercase tracking-wider">Nr</th>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider">Namn</th>
                    <th className="hidden px-4 py-3 font-bold uppercase tracking-wider md:table-cell">Klubb</th>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider">Distans</th>
                    <th className="px-4 py-3 text-right font-bold uppercase tracking-wider">Tid</th>
                    <th className="px-4 py-3"></th>
                    <th className="px-4 py-3 text-center font-bold uppercase tracking-wider">Buss</th>
                    <th className="px-4 py-3 text-center font-bold uppercase tracking-wider">Betalat</th>
                  </tr>
                </thead>
                <tbody data-testid="admin-registrations-body">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Inga anmälningar.</td></tr>
                  ) : (
                    filtered.map((r, i) => (
                      <tr key={r.bib_number} className={i % 2 ? "bg-brand-sand/40" : "bg-white"}>
                        <td className="px-4 py-3 font-bold text-brand">{r.bib_number}</td>
                        <td className="px-4 py-3 font-semibold text-brand-forest">{r.name}</td>
                        <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{r.club}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.distance}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          {editBib === r.bib_number ? (
                            <input
                              autoFocus
                              value={editTime}
                              onChange={(e) => setEditTime(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(r.bib_number); if (e.key === "Escape") cancelEdit(); }}
                              data-testid={`edit-time-input-${r.bib_number}`}
                              placeholder="TT:MM:SS"
                              className="w-28 rounded-sm border border-brand px-2 py-1 text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                            />
                          ) : r.finish_time ? (
                            <span className="text-brand-forest">{r.finish_time}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-muted-foreground/60"><Clock size={13} /> —</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editBib === r.bib_number ? (
                            <div className="inline-flex items-center gap-2">
                              <button onClick={() => saveEdit(r.bib_number)} data-testid={`save-time-${r.bib_number}`} className="text-brand-moss transition-colors hover:text-brand-forest" title="Spara">
                                <Check size={17} />
                              </button>
                              <button onClick={cancelEdit} data-testid={`cancel-time-${r.bib_number}`} className="text-muted-foreground transition-colors hover:text-destructive" title="Avbryt">
                                <X size={17} />
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-3">
                              <button onClick={() => startEdit(r)} data-testid={`edit-time-${r.bib_number}`} className="text-muted-foreground transition-colors hover:text-brand" title="Ändra tid">
                                <Pencil size={15} />
                              </button>
                              {r.finish_time && (
                                <button onClick={() => clearTime(r.bib_number)} data-testid={`clear-time-${r.bib_number}`} className="text-muted-foreground transition-colors hover:text-destructive" title="Rensa tid">
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {takesBus(r) ? (
                            <span data-testid={`bus-badge-${r.bib_number}`} title="Ska åka buss" className="inline-flex items-center justify-center text-brand">
                              <Bus size={18} />
                            </span>
                          ) : (
                            <span className="text-muted-foreground/30">–</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={!!r.paid}
                            onChange={() => togglePaid(r)}
                            data-testid={`paid-checkbox-${r.bib_number}`}
                            title={r.paid ? "Avgift betald" : "Avgift ej betald"}
                            className="h-5 w-5 cursor-pointer accent-brand-moss"
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
