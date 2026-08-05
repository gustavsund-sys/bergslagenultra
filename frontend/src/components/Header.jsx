import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { LOGO_URL } from "@/lib/api";

const links = [
  { to: "/", label: "Hem" },
  { to: "/anmalan", label: "Anmälan" },
  { to: "/startlista", label: "Startlista" },
  { to: "/resultat", label: "Resultat" },
];

export const Header = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
        <Link to="/" className="flex items-center gap-3" data-testid="header-logo-link">
          <img src={LOGO_URL} alt="Bergslagsleden Ultra" className="h-11 w-11 object-contain" />
          <div className="leading-none">
            <div className="font-display text-sm font-extrabold uppercase tracking-tight text-brand-forest sm:text-base">
              Bergslagsleden
            </div>
            <div className="font-display text-[10px] font-bold uppercase tracking-[0.35em] text-brand">
              Ultra
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              data-testid={`nav-${l.label.toLowerCase()}`}
              className={`text-sm font-bold uppercase tracking-wide transition-colors hover:text-brand ${
                pathname === l.to ? "text-brand" : "text-brand-forest"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <Link
            to="/anmalan"
            data-testid="header-register-cta"
            className="inline-flex items-center rounded-sm bg-brand px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-all hover:-translate-y-0.5 hover:bg-brand-hover"
          >
            Anmäl dig
          </Link>
        </div>

        <button
          className="md:hidden text-brand-forest"
          onClick={() => setOpen(!open)}
          data-testid="mobile-menu-toggle"
          aria-label="Meny"
        >
          {open ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-white md:hidden">
          <nav className="flex flex-col px-5 py-2">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                data-testid={`mobile-nav-${l.label.toLowerCase()}`}
                className="border-b border-border/60 py-3 text-sm font-bold uppercase tracking-wide text-brand-forest"
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/anmalan"
              onClick={() => setOpen(false)}
              className="mt-3 mb-2 rounded-sm bg-brand px-5 py-3 text-center text-sm font-bold uppercase tracking-wide text-white"
            >
              Anmäl dig
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
};
