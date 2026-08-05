import { Link } from "react-router-dom";
import { LOGO_URL } from "@/lib/api";

export const Footer = () => (
  <footer className="mt-24 bg-brand-forest text-white">
    <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:grid-cols-3 sm:px-8">
      <div>
        <div className="flex items-center gap-3">
          <img src={LOGO_URL} alt="Logo" className="h-12 w-12 rounded-full bg-white/95 object-contain p-1" />
          <div className="font-display text-lg font-extrabold uppercase tracking-tight">
            Bergslagsleden Ultra
          </div>
        </div>
        <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
          Traillopp genom Bergslagens skogar. Digerberget–Ånnaboda, 12 september 2026.
        </p>
      </div>
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-brand">Navigering</div>
        <ul className="mt-4 space-y-2 text-sm text-white/70">
          <li><Link to="/anmalan" className="hover:text-brand">Anmälan</Link></li>
          <li><Link to="/startlista" className="hover:text-brand">Startlista</Link></li>
          <li><Link to="/resultat" className="hover:text-brand">Resultat</Link></li>
          <li><Link to="/admin/login" className="hover:text-brand">Funktionär</Link></li>
        </ul>
      </div>
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-brand">Betalning & insamling</div>
        <p className="mt-4 text-sm text-white/70">Swish: 070-2417158</p>
        <p className="mt-1 text-sm text-white/70">Nordea PG: 54 94 79-4</p>
        <p className="mt-3 text-sm text-white/70">Överskott går till Barndiabetesfonden.</p>
      </div>
    </div>
    <div className="border-t border-white/10 py-5 text-center text-xs text-white/40">
      © {new Date().getFullYear()} Föreningen Nature Running · Bergslagsleden Ultra
    </div>
  </footer>
);
