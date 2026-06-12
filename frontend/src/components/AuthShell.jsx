import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

const AUTH_IMG = "https://images.pexels.com/photos/35431571/pexels-photo-35431571.jpeg";

export default function AuthShell({ children }) {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex">
      {/* Left: form */}
      <div className="flex-1 flex flex-col px-6 sm:px-12 py-8 max-w-2xl mx-auto md:mx-0 w-full">
        <Link to="/" className="flex items-center gap-2 mb-12" data-testid="auth-brand-link">
          <div className="w-8 h-8 rounded-md bg-[#BAFB00] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-black" />
          </div>
          <span className="font-display font-black text-2xl tracking-[-0.02em]">GYLFA</span>
        </Link>
        <div className="flex-1 flex items-center">
          <div className="w-full max-w-md mx-auto animate-fade-up">{children}</div>
        </div>
        <p className="font-mono-label text-[10px] text-zinc-500 text-center mt-8">© 2026 · Gylfa</p>
      </div>

      {/* Right: image (desktop only) */}
      <div className="hidden lg:block relative flex-1 max-w-[640px]">
        <img src={AUTH_IMG} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-l from-[#050505]/0 via-[#050505]/40 to-[#050505]/90" />
        <div className="absolute inset-0 flex items-end p-12">
          <div className="max-w-md">
            <p className="font-mono-label text-[10px] text-[#BAFB00] mb-4">// Manifesto</p>
            <p className="font-display font-black text-3xl tracking-[-0.02em] leading-tight">
              "The only way out is through.{" "}
              <span className="text-[#BAFB00]">And it's faster with a pack.</span>"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
