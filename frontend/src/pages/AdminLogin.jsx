import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiErrorDetail, LOGO_URL } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";

export default function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/admin");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || "Inloggning misslyckades.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-forest px-5 grain">
      <div className="relative w-full max-w-md rounded-md border border-white/10 bg-white p-8 sm:p-10">
        <div className="flex flex-col items-center text-center">
          <img src={LOGO_URL} alt="Logo" className="h-16 w-16 object-contain" />
          <div className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-brand">
            <Lock size={14} /> Funktionär
          </div>
          <h1 className="mt-2 font-display text-2xl font-black uppercase tracking-tight text-brand-forest">
            Admininloggning
          </h1>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-5" data-testid="admin-login-form">
          <div>
            <Label htmlFor="email" className="text-xs font-bold uppercase tracking-[0.2em]">Användarnamn</Label>
            <Input id="email" type="text" data-testid="login-email" className="mt-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin" />
          </div>
          <div>
            <Label htmlFor="password" className="text-xs font-bold uppercase tracking-[0.2em]">Lösenord</Label>
            <Input id="password" type="password" data-testid="login-password" className="mt-2" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {error && <p className="text-sm font-semibold text-destructive" data-testid="login-error">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            data-testid="login-submit"
            className="w-full rounded-sm bg-brand px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-all hover:-translate-y-0.5 hover:bg-brand-hover disabled:opacity-60"
          >
            {loading ? "Loggar in…" : "Logga in"}
          </button>
        </form>
      </div>
    </div>
  );
}
