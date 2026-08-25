import { CalendarClock } from "lucide-react";
import { formatCountdown, formatOpeningDate } from "@/hooks/useRegistrationStatus";

export function RegistrationCountdown({ status, compact = false, dark = false }) {
  if (!status || status.phase === "open") return null;

  const opening = formatOpeningDate(status.openAt);
  if (status.phase === "countdown") {
    const parts = formatCountdown(status.remainingMs);
    return (
      <div className={`rounded-md border border-brand/40 bg-brand-sand text-brand-forest ${compact ? "px-4 py-3" : "p-6"}`} data-testid="registration-countdown">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-moss">
          <CalendarClock size={16} /> Anmälan öppnar om
        </div>
        <div className={`mt-2 font-mono font-black tabular-nums text-brand ${compact ? "text-xl" : "text-3xl sm:text-4xl"}`}>
          {parts.days}d {String(parts.hours).padStart(2, "0")}h {String(parts.minutes).padStart(2, "0")}m {String(parts.seconds).padStart(2, "0")}s
        </div>
        <div className="mt-1 text-xs font-semibold text-muted-foreground">{opening}</div>
      </div>
    );
  }

  return (
    <div className={`rounded-md border ${dark ? "border-white/20 bg-white/10 text-white" : "border-border bg-white text-brand-forest"} ${compact ? "px-4 py-3" : "p-6"}`} data-testid="registration-scheduled">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em]">
        <CalendarClock size={16} /> {status.phase === "closed" ? "Anmälan är stängd" : "Anmälan öppnar senare"}
      </div>
      {status.phase === "scheduled" && opening && <div className="mt-2 font-semibold">{opening}</div>}
    </div>
  );
}
