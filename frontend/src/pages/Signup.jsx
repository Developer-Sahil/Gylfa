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
