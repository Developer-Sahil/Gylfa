import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AuthShell from "@/components/AuthShell";
import { formatApiError } from "@/lib/api";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

/** Map Firebase Auth error codes to user-friendly messages. */
function firebaseErrorMessage(err) {
  const code = err?.code || "";
  if (code === "auth/email-already-in-use")
    return "An account with this email already exists. Try signing in.";
  if (code === "auth/weak-password")
    return "Password must be at least 6 characters.";
  if (code === "auth/invalid-email")
    return "Please enter a valid email address.";
  if (code === "auth/popup-closed-by-user")
    return "Google sign-in was cancelled.";
  if (code === "auth/network-request-failed")
    return "Network error. Check your connection.";
  return formatApiError(err?.response?.data?.detail) || err?.message || "Something went wrong.";
}

export default function Signup() {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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
      setError(firebaseErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
      toast.success("Welcome to the pack.");
      navigate("/dashboard");
    } catch (err) {
      setError(firebaseErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthShell>
      <p className="font-mono-label text-[10px] text-[#BAFB00] mb-3">// Create account</p>
      <h1 className="font-display font-black text-4xl sm:text-5xl tracking-[-0.02em] leading-tight">
        Build your <span className="text-[#BAFB00]">pack.</span>
      </h1>
      <p className="mt-3 text-zinc-400 text-sm">Six minutes to your first quest.</p>

      {/* Google Sign-Up */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={googleLoading || submitting}
        className="mt-8 w-full inline-flex items-center justify-center gap-3 px-6 py-3 rounded-full glass border border-white/10 text-white hover:bg-white/10 transition-colors disabled:opacity-50"
        data-testid="signup-google-btn"
      >
        {googleLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        )}
        Continue with Google
      </button>

      <div className="flex items-center gap-3 mt-6">
        <div className="flex-1 h-px bg-white/10" />
        <span className="font-mono-label text-[10px] text-zinc-500">or</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4">
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
          disabled={submitting || googleLoading}
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
