import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const { googleExchange } = useAuth();
  const navigate = useNavigate();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = window.location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) {
      navigate("/login", { replace: true });
      return;
    }
    const sid = decodeURIComponent(m[1]);
    googleExchange(sid)
      .then(() => {
        // clear hash and go to dashboard
        window.history.replaceState(null, "", window.location.pathname);
        navigate("/dashboard", { replace: true });
      })
      .catch(() => {
        navigate("/login?error=oauth", { replace: true });
      });
  }, [googleExchange, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white">
      <div className="flex flex-col items-center gap-3" data-testid="auth-callback-loading">
        <Loader2 className="w-6 h-6 animate-spin text-[#BAFB00]" />
        <p className="font-mono-label text-xs text-zinc-400">Authenticating…</p>
      </div>
    </div>
  );
}
