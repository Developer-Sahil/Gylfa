import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "@/lib/api";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Loader2, Sparkles, Trophy, Footprints, Flame, Shield, Swords, Users, ArrowRight } from "lucide-react";

const ICON_MAP = { footprints: Footprints, flame: Flame, shield: Shield, sparkles: Sparkles, swords: Swords, trophy: Trophy, users: Users };

export default function PublicProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_BASE}/users/${id}/public`)
      .then((r) => setProfile(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <Loader2 className="w-6 h-6 animate-spin text-[#BAFB00]" />
      </div>
    );
  }
  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center px-6" data-testid="public-profile-not-found">
        <p className="font-mono-label text-[10px] text-[#BAFB00]">// 404</p>
        <h1 className="font-display font-black text-4xl mt-2 tracking-[-0.02em]">Hunter not found.</h1>
        <Link to="/" className="mt-6 px-5 py-2.5 rounded-full bg-[#BAFB00] text-black font-bold text-sm">Go home</Link>
      </div>
    );
  }

  const history = profile.xp_history.map((d) => ({
    day: new Date(d.date).toLocaleDateString("en-US", { weekday: "short" }),
    xp: d.xp,
  }));

  return (
    <div className="min-h-screen bg-[#050505] text-white" data-testid="public-profile-page">
      <header className="px-6 py-4 border-b border-white/5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="public-brand-link">
            <div className="w-7 h-7 rounded-md bg-[#BAFB00] flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-black" />
            </div>
            <span className="font-display font-black text-xl tracking-[-0.02em]">GYLFA</span>
          </Link>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#BAFB00] text-black font-bold text-sm hover:bg-[#A3E635] transition-colors"
            data-testid="public-cta-join"
          >
            Build your circle <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 animate-fade-up">
        <div className="glass rounded-3xl p-8 md:p-12 relative grain">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-gradient-to-br from-[#BAFB00]/40 via-white/10 to-white/[0.02] border border-white/10 flex items-center justify-center font-display font-black text-4xl md:text-5xl">
              {profile.avatar?.slice?.(0, 2) || "U"}
            </div>
            <div className="flex-1">
              <p className="font-mono-label text-[10px] text-[#BAFB00]">// Public profile</p>
              <h1 className="mt-1 font-display font-black text-4xl tracking-[-0.02em]" data-testid="public-profile-name">{profile.name}</h1>
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#BAFB00]/10 border border-[#BAFB00]/30">
                <Sparkles className="w-3.5 h-3.5 text-[#BAFB00]" />
                <span className="font-mono-label text-[10px] text-[#BAFB00]">Lv.{profile.level} · {profile.title}</span>
              </div>
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl">
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3">
                  <p className="font-mono-label text-[10px] text-zinc-400">XP</p>
                  <p className="font-display font-black text-2xl text-[#BAFB00] mt-1">{profile.xp.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3">
                  <p className="font-mono-label text-[10px] text-zinc-400">Streak</p>
                  <p className="font-display font-black text-2xl mt-1">{profile.streak}d</p>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3">
                  <p className="font-mono-label text-[10px] text-zinc-400">Longest</p>
                  <p className="font-display font-black text-2xl mt-1">{profile.longest_streak}d</p>
                </div>
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3">
                  <p className="font-mono-label text-[10px] text-zinc-400">Check-ins</p>
                  <p className="font-display font-black text-2xl mt-1">{profile.total_checkins}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass rounded-3xl p-6">
            <h2 className="font-display font-extrabold text-2xl tracking-tight">14-day XP</h2>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="day" stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#0e0e10", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "white", fontSize: 12 }} />
                  <Line type="monotone" dataKey="xp" stroke="#BAFB00" strokeWidth={2.5} dot={{ fill: "#BAFB00", r: 3 }} activeDot={{ r: 5 }} style={{ filter: "drop-shadow(0 0 6px rgba(186,251,0,0.5))" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass rounded-3xl p-6" data-testid="public-achievements">
            <h2 className="font-display font-extrabold text-2xl tracking-tight">Unlocked achievements</h2>
            {profile.achievements.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-400">No achievements unlocked yet.</p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {profile.achievements.map((a) => {
                  const Icon = ICON_MAP[a.icon] || Trophy;
                  return (
                    <div key={a.id} className="rounded-2xl bg-white/[0.03] border border-[#BAFB00]/30 p-4">
                      <div className="w-9 h-9 rounded-xl bg-[#BAFB00]/10 border border-[#BAFB00]/30 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-[#BAFB00]" />
                      </div>
                      <p className="mt-3 font-display font-bold text-sm">{a.title}</p>
                      <p className="text-xs text-zinc-400 leading-relaxed">{a.description}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 glass rounded-3xl p-8 text-center" data-testid="public-cta-block">
          <p className="font-mono-label text-[10px] text-[#BAFB00]">// Join the pack</p>
          <h3 className="mt-3 font-display font-black text-2xl sm:text-3xl tracking-[-0.02em]">
            Compete alongside {profile.name.split(" ")[0]}.
          </h3>
          <Link to="/signup" className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#BAFB00] text-black font-bold hover:bg-[#A3E635] transition-colors">
            Get started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
