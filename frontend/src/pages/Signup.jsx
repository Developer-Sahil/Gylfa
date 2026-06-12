import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AuthShell from "@/components/AuthShell";
import { formatApiError } from "@/lib/api";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

export default function Signup() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await register(name, email, password);
      toast.success("Welcome to the pack.");
      navigate("/dashboard");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const googleSignup = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH.
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <AuthShell>
      <p className="font-mono-label text-[10px] text-[#BAFB00] mb-3">// Create account</p>
      <h1 className="font-display font-black text-4xl sm:text-5xl tracking-[-0.02em] leading-tight">
        Build your <span className="text-[#BAFB00]">pack.</span>
      </h1>
      <p className="mt-3 text-zinc-400 text-sm">Six minutes to your first quest.</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label className="font-mono-label text-[10px] text-zinc-400">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[#BAFB00] focus:outline-none text-white placeholder:text-zinc-600"
            placeholder="Your name"
            data-testid="signup-name-input"
          />
        </div>
        <div>
          <label className="font-mono-label text-[10px] text-zinc-400">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[#BAFB00] focus:outline-none text-white placeholder:text-zinc-600"
            placeholder="you@gylfa.app"
            data-testid="signup-email-input"
          />
        </div>
        <div>
          <label className="font-mono-label text-[10px] text-zinc-400">Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[#BAFB00] focus:outline-none text-white placeholder:text-zinc-600"
            placeholder="At least 6 characters"
            data-testid="signup-password-input"
          />
        </div>

        {error && <p className="text-sm text-red-400" data-testid="signup-error">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#BAFB00] text-black font-bold hover:bg-[#A3E635] transition-colors disabled:opacity-50"
          data-testid="signup-submit-btn"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          Create account
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
          <div className="relative flex justify-center"><span className="px-3 bg-[#050505] font-mono-label text-[10px] text-zinc-500">or</span></div>
        </div>

        <button
          type="button"
          onClick={googleSignup}
          className="w-full px-6 py-3 rounded-full bg-white text-black font-medium hover:bg-zinc-200 transition-colors text-sm flex items-center justify-center gap-2"
          data-testid="signup-google-btn"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.997 10.997 0 0 0 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.48 12c0-.73.13-1.44.36-2.1V7.06H2.18A10.997 10.997 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
          </svg>
          Continue with Google
        </button>
      </form>

      <p className="mt-6 text-sm text-zinc-400 text-center">
        Already in?{" "}
        <Link to="/login" className="text-[#BAFB00] hover:text-[#A3E635]" data-testid="signup-go-login">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
