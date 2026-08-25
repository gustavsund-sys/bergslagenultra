import { useEffect, useMemo, useState } from "react";
import { DEFAULT_EVENT_SETTINGS, subscribeEventSettings } from "@/lib/api";

const DAY_MS = 24 * 60 * 60 * 1000;

export function getRegistrationStatus(settings, now = Date.now()) {
  const config = settings || DEFAULT_EVENT_SETTINGS;
  const openAt = config.registration_open_at ? new Date(config.registration_open_at).getTime() : null;
  const closeAt = config.registration_close_at ? new Date(config.registration_close_at).getTime() : null;

  if (!config.registration_enabled) return { phase: "closed", remainingMs: 0, openAt, closeAt };
  if (openAt && now < openAt) {
    const remainingMs = openAt - now;
    const countdownWindow = Math.max(0, Number(config.countdown_days) || 0) * DAY_MS;
    return {
      phase: countdownWindow > 0 && remainingMs <= countdownWindow ? "countdown" : "scheduled",
      remainingMs,
      openAt,
      closeAt,
    };
  }
  if (closeAt && now > closeAt) return { phase: "closed", remainingMs: 0, openAt, closeAt };
  return { phase: "open", remainingMs: 0, openAt, closeAt };
}

export function formatCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

export function formatOpeningDate(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function useRegistrationStatus() {
  const [settings, setSettings] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState(false);

  useEffect(() => subscribeEventSettings(
    (next) => { setSettings(next); setError(false); },
    () => { setSettings(DEFAULT_EVENT_SETTINGS); setError(true); },
  ), []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const status = useMemo(() => settings ? getRegistrationStatus(settings, now) : null, [settings, now]);
  return { settings, status, error };
}
