import { useState } from "react";
import { Link } from "react-router-dom";
import AuthShell from "@/components/AuthShell";
import { api, formatApiError } from "@/lib/api";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/auth/forgot-password", { email });
      setDone(true);
      toast.success("Reset link sent (check the email-mock log if dev).");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <p className="font-mono-label text-[10px] text-[#BAFB00] mb-3">// Recovery</p>
      <h1 className="font-display font-black text-4xl tracking-[-0.02em]">Forgot password</h1>
      <p className="mt-3 text-zinc-400 text-sm">We'll send a reset link valid for 1 hour.</p>

      {done ? (
        <div className="mt-8 p-5 rounded-2xl glass" data-testid="forgot-success">
          <p className="text-sm text-zinc-300">
            If an account exists for <strong>{email}</strong>, we sent a reset link. Check your inbox.
          </p>
          <Link to="/login" className="font-mono-label text-[10px] text-[#BAFB00] mt-3 inline-block" data-testid="back-to-login-link">
            ← Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <label className="font-mono-label text-[10px] text-zinc-400">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[#BAFB00] focus:outline-none text-white placeholder:text-zinc-600"
              placeholder="you@gylfa.app"
              data-testid="forgot-email-input"
            />
          </div>
          {error && <p className="text-sm text-red-400" data-testid="forgot-error">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#BAFB00] text-black font-bold hover:bg-[#A3E635] transition-colors disabled:opacity-50"
            data-testid="forgot-submit-btn"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Send reset link
          </button>
        </form>
      )}

      <p className="mt-6 text-sm text-zinc-400">
        <Link to="/login" className="text-[#BAFB00] hover:text-[#A3E635]" data-testid="forgot-go-login">
          ← Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
