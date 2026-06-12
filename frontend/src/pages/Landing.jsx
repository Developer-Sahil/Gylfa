import { Link } from "react-router-dom";
import {
  ArrowRight,
  Target,
  Users,
  Flame,
  Trophy,
  ShieldCheck,
  Activity,
  Sparkles,
} from "lucide-react";

const HERO_IMG = "https://images.pexels.com/photos/19146676/pexels-photo-19146676.jpeg";

function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-40">
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="glass rounded-full px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="landing-brand-link">
            <div className="w-7 h-7 rounded-md bg-[#BAFB00] flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-black" />
            </div>
            <span className="font-display font-black text-xl tracking-[-0.02em]">GYLFA</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 font-mono-label text-[11px] text-zinc-300">
            <a href="#features" className="hover:text-white" data-testid="landing-link-features">Features</a>
            <a href="#protocol" className="hover:text-white" data-testid="landing-link-protocol">Protocol</a>
            <a href="#manifesto" className="hover:text-white" data-testid="landing-link-manifesto">Manifesto</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="px-3 py-1.5 text-sm text-zinc-300 hover:text-white" data-testid="landing-login-link">
              Sign in
            </Link>
            <Link
              to="/signup"
              className="px-4 py-2 rounded-full bg-[#BAFB00] text-black text-sm font-bold hover:bg-[#A3E635] transition-colors"
              data-testid="landing-signup-cta"
            >
              Get started
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

const stats = [
  { value: "82%", label: "of solo goals fail" },
  { value: "14×", label: "more likely with accountability" },
  { value: "5 min", label: "to set up your circle" },
  { value: "100%", label: "private by default" },
];

const features = [
  { icon: Target, title: "Daily quests", body: "Set personal goals with XP rewards. Daily or weekly. Track completions and streaks." },
  { icon: Flame, title: "Streaks that bite", body: "Miss a day and the streak burns. Hit milestones at 3, 7, 14, 30, 50, 100 days." },
  { icon: Users, title: "Private circles", body: "Up to 30 members. Invite by code only. Your circle, your rules." },
  { icon: Trophy, title: "Live leaderboards", body: "XP-ranked. Crown on #1. Pressure that pulls everyone up — not down." },
  { icon: ShieldCheck, title: "Visibility, not surveillance", body: "Members see check-ins, not your private notes. Default to dignity." },
  { icon: Activity, title: "Weekly digest", body: "Every Monday 09:00 UTC. Top 5 + streak survivors. Delivered via email." },
];

const protocol = [
  { step: "01", title: "Recruit your pack", body: "Invite up to 30 people you actually want to grow with." },
  { step: "02", title: "Set your quests", body: "3–5 daily quests, 1–2 weekly. Earn XP for every completion." },
  { step: "03", title: "Show up daily", body: "Check in. Build streak. Climb the leaderboard." },
  { step: "04", title: "Survive the digest", body: "Monday morning: see who held the line." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#050505] text-white relative overflow-x-hidden">
      <Nav />

      {/* HERO */}
      <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 px-6">
        <div className="absolute inset-0 -z-10">
          <img src={HERO_IMG} alt="" className="w-full h-full object-cover opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/85 to-transparent" />
          <div className="absolute inset-0 bg-[#050505]/60" />
        </div>
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl animate-fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#BAFB00] acid-glow" />
              <span className="font-mono-label text-[10px] text-zinc-300">Now in private beta</span>
            </div>
            <h1 className="font-display font-black text-5xl sm:text-6xl lg:text-7xl tracking-[-0.02em] leading-[0.95]">
              Discipline,
              <br />
              <span className="text-[#BAFB00]">witnessed.</span>
            </h1>
            <p className="mt-6 max-w-xl text-zinc-300 text-lg leading-relaxed">
              Gylfa is a private accountability platform for small circles. Set quests, hold streaks, earn XP — together. The pack moves or it dies.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#BAFB00] text-black font-bold hover:bg-[#A3E635] transition-colors"
                data-testid="hero-cta-signup"
              >
                Build your circle <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full glass text-white hover:bg-white/10 transition-colors"
                data-testid="hero-cta-login"
              >
                Sign in
              </Link>
            </div>
          </div>

          {/* Stat strip */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="glass rounded-2xl p-5" data-testid={`stat-${s.value}`}>
                <p className="font-display text-4xl font-black text-white">{s.value}</p>
                <p className="font-mono-label text-[10px] text-zinc-400 mt-2">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="font-mono-label text-[10px] text-[#BAFB00] mb-3">// Features</p>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-[-0.02em]">
              Six systems. One outcome.
            </h2>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <div key={f.title} className="glass rounded-2xl p-6 hover:-translate-y-1 transition-transform duration-300">
                <div className="w-10 h-10 rounded-xl bg-[#BAFB00]/10 border border-[#BAFB00]/30 flex items-center justify-center">
                  <f.icon className="w-5 h-5 text-[#BAFB00]" />
                </div>
                <h3 className="mt-4 font-display font-bold text-xl">{f.title}</h3>
                <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROTOCOL */}
      <section id="protocol" className="px-6 py-24 bg-[#0a0a0a]">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="font-mono-label text-[10px] text-[#BAFB00] mb-3">// Protocol</p>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-[-0.02em]">
              Four steps to a self that ships.
            </h2>
          </div>
          <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {protocol.map((p) => (
              <div key={p.step} className="glass rounded-2xl p-6">
                <p className="font-mono-label text-[10px] text-[#BAFB00]">{p.step}</p>
                <h3 className="mt-3 font-display font-bold text-xl">{p.title}</h3>
                <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MANIFESTO / QUOTE */}
      <section id="manifesto" className="px-6 py-24">
        <div className="mx-auto max-w-4xl glass-strong rounded-3xl p-10 md:p-16">
          <p className="font-mono-label text-[10px] text-[#BAFB00] mb-6">// Manifesto</p>
          <blockquote className="font-display font-black text-3xl sm:text-4xl lg:text-5xl tracking-[-0.02em] leading-[1.05]">
            "Most people don't lack motivation. They lack <span className="text-[#BAFB00]">witnesses</span>.
            Gylfa builds the room where the work is unavoidable."
          </blockquote>
          <p className="mt-8 font-mono-label text-[10px] text-zinc-400">— Aria Shadow, founding member</p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-4xl glass rounded-3xl p-10 md:p-14 text-center">
          <h2 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl tracking-[-0.02em]">
            Step into the room.
          </h2>
          <p className="mt-3 text-zinc-400">No credit card. Free for circles up to 30 members.</p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 mt-8 px-7 py-3.5 rounded-full bg-[#BAFB00] text-black font-bold hover:bg-[#A3E635] transition-colors"
            data-testid="cta-bottom-signup"
          >
            Build your circle <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="px-6 py-10 border-t border-white/5">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#BAFB00] flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-black" />
            </div>
            <span className="font-display font-black tracking-[-0.02em]">GYLFA</span>
          </div>
          <p className="font-mono-label text-[10px] text-zinc-500">© 2026 · The pack moves or it dies.</p>
        </div>
      </footer>
    </div>
  );
}
