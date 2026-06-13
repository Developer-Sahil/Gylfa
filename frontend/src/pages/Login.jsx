import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AuthShell from "@/components/AuthShell";
import { formatApiError } from "@/lib/api";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      toast.success("Welcome back, hunter.");
      navigate("/dashboard");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const useDemo = () => {
    setEmail("demo@gylfa.app");
    setPassword("demo123");
  };


  return (
    <AuthShell>
      <p className="font-mono-label text-[10px] text-[#BAFB00] mb-3">// Sign in</p>
      <h1 className="font-display font-black text-4xl sm:text-5xl tracking-[-0.02em] leading-tight">
        Step back into <span className="text-[#BAFB00]">the room.</span>
      </h1>
      <p className="mt-3 text-zinc-400 text-sm">Your circle is waiting.</p>

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
            data-testid="login-email-input"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="font-mono-label text-[10px] text-zinc-400">Password</label>
            <Link to="/forgot-password" className="font-mono-label text-[10px] text-[#BAFB00] hover:text-[#A3E635]" data-testid="forgot-password-link">
              Forgot?
            </Link>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[#BAFB00] focus:outline-none text-white placeholder:text-zinc-600"
            placeholder="••••••••"
            data-testid="login-password-input"
          />
        </div>

        {error && <p className="text-sm text-red-400" data-testid="login-error">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#BAFB00] text-black font-bold hover:bg-[#A3E635] transition-colors disabled:opacity-50"
          data-testid="login-submit-btn"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          Sign in
        </button>

        <button
          type="button"
          onClick={useDemo}
          className="w-full px-6 py-3 rounded-full glass text-zinc-200 hover:bg-white/10 transition-colors text-sm"
          data-testid="login-demo-btn"
        >
          Use demo credentials
        </button>


      </form>

      <p className="mt-6 text-sm text-zinc-400 text-center">
        New to Gylfa?{" "}
        <Link to="/signup" className="text-[#BAFB00] hover:text-[#A3E635]" data-testid="login-go-signup">
          Create a circle
        </Link>
      </p>
    </AuthShell>
  );
}
