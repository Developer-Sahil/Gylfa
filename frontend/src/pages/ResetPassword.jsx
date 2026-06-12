import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthShell from "@/components/AuthShell";
import { api, formatApiError } from "@/lib/api";
import { Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/auth/reset-password", { token, password });
      toast.success("Password reset. Sign in with your new password.");
      navigate("/login");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <p className="font-mono-label text-[10px] text-[#BAFB00] mb-3">// Recovery</p>
      <h1 className="font-display font-black text-4xl tracking-[-0.02em]">Reset password</h1>
      <p className="mt-3 text-zinc-400 text-sm">Choose a strong new password (6+ chars).</p>

      {!token ? (
        <p className="mt-8 text-sm text-red-400" data-testid="reset-missing-token">Missing or invalid reset token.</p>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <label className="font-mono-label text-[10px] text-zinc-400">New password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[#BAFB00] focus:outline-none text-white"
              placeholder="••••••••"
              data-testid="reset-password-input"
            />
          </div>
          {error && <p className="text-sm text-red-400" data-testid="reset-error">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#BAFB00] text-black font-bold hover:bg-[#A3E635] transition-colors disabled:opacity-50"
            data-testid="reset-submit-btn"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            Reset password
          </button>
        </form>
      )}
      <p className="mt-6 text-sm text-zinc-400">
        <Link to="/login" className="text-[#BAFB00] hover:text-[#A3E635]" data-testid="reset-go-login">← Back to sign in</Link>
      </p>
    </AuthShell>
  );
}
