import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  Trophy, Footprints, Flame, Shield, Sparkles, Swords, Users, Lock, Loader2, Share2, Check,
} from "lucide-react";
import { toast } from "sonner";

const ICON_MAP = { footprints: Footprints, flame: Flame, shield: Shield, sparkles: Sparkles, swords: Swords, trophy: Trophy, users: Users };

function buildXpHistory(checkins) {
  const days = 14;
  const today = new Date();
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const xp = checkins.filter((c) => c.date === iso).reduce((s, c) => s + (c.xp_earned || 0), 0);
    out.push({ day: d.toLocaleDateString("en-US", { weekday: "short" }), date: iso, xp });
  }
  return out;
}

function xpForLevel(n) { return 50 * (n - 1) * n; }

export default function Profile() {
  const { user } = useAuth();
  const [checkins, setCheckins] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const shareProfile = async () => {
    const url = `${window.location.origin}/u/${user.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Public profile link copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Copy failed");
    }
  };

  useEffect(() => {
    Promise.all([api.get("/checkins"), api.get("/achievements")])
      .then(([c, a]) => { setCheckins(c.data); setAchievements(a.data); })
      .finally(() => setLoading(false));
  }, []);

  if (!user || loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#BAFB00]" /></div>;

  const history = buildXpHistory(checkins);
  const prevXp = xpForLevel(user.level);
  const nextXp = xpForLevel(user.level + 1);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto animate-fade-up" data-testid="profile-page">
      <div className="glass rounded-3xl p-6 md:p-10 flex flex-col md:flex-row items-start gap-8 relative grain">
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-gradient-to-br from-[#BAFB00]/40 via-white/10 to-white/[0.02] border border-white/10 flex items-center justify-center font-display font-black text-4xl md:text-5xl">
          {user.avatar?.slice?.(0, 2) || "U"}
        </div>
        <div className="flex-1">
          <p className="font-mono-label text-[10px] text-[#BAFB00]">// Profile</p>
          <h1 className="mt-1 font-display font-black text-4xl tracking-[-0.02em]">{user.name}</h1>
          <p className="mt-1 text-zinc-400 text-sm">{user.email}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#BAFB00]/10 border border-[#BAFB00]/30">
              <Sparkles className="w-3.5 h-3.5 text-[#BAFB00]" />
              <span className="font-mono-label text-[10px] text-[#BAFB00]">Lv.{user.level} · {user.title}</span>
            </div>
            <button
              onClick={shareProfile}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-zinc-200 hover:bg-white/10 text-xs"
              data-testid="share-public-profile-btn"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#BAFB00]" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="font-mono-label text-[10px]">Share public profile</span>
            </button>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 max-w-xl">
            <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3" data-testid="profile-mini-xp">
              <p className="font-mono-label text-[10px] text-zinc-400">XP</p>
              <p className="font-display font-black text-2xl text-[#BAFB00] mt-1">{user.xp.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3" data-testid="profile-mini-streak">
              <p className="font-mono-label text-[10px] text-zinc-400">Streak</p>
              <p className="font-display font-black text-2xl mt-1">{user.streak}d</p>
            </div>
            <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3" data-testid="profile-mini-checkins">
              <p className="font-mono-label text-[10px] text-zinc-400">Check-ins</p>
              <p className="font-display font-black text-2xl mt-1">{user.total_checkins || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-3xl p-6" data-testid="xp-history-chart">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-extrabold text-2xl tracking-tight">14-day XP</h2>
            <p className="font-mono-label text-[10px] text-zinc-400">// last two weeks</p>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="day" stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "#0e0e10", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "white", fontSize: 12 }}
                  labelStyle={{ color: "#a1a1aa", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em" }}
                />
                <Line type="monotone" dataKey="xp" stroke="#BAFB00" strokeWidth={2.5} dot={{ fill: "#BAFB00", r: 3 }} activeDot={{ r: 5 }} style={{ filter: "drop-shadow(0 0 6px rgba(186,251,0,0.5))" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-3xl p-6" data-testid="personal-stats">
          <h2 className="font-display font-extrabold text-2xl tracking-tight">Stats</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-zinc-400">Level</dt><dd className="font-display font-bold">{user.level}</dd></div>
            <div className="flex justify-between"><dt className="text-zinc-400">XP to next</dt><dd className="font-display font-bold text-[#BAFB00]">{(nextXp - user.xp).toLocaleString()}</dd></div>
            <div className="flex justify-between"><dt className="text-zinc-400">Current streak</dt><dd className="font-display font-bold">{user.streak}d</dd></div>
            <div className="flex justify-between"><dt className="text-zinc-400">Longest streak</dt><dd className="font-display font-bold">{user.longest_streak}d</dd></div>
            <div className="flex justify-between"><dt className="text-zinc-400">Total check-ins</dt><dd className="font-display font-bold">{user.total_checkins || 0}</dd></div>
            <div className="flex justify-between"><dt className="text-zinc-400">Title</dt><dd className="font-display font-bold">{user.title}</dd></div>
          </dl>
        </div>
      </div>

      <div className="mt-8" data-testid="achievements-grid">
        <h2 className="font-display font-extrabold text-2xl tracking-tight">Achievements</h2>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {achievements.map((a) => {
            const Icon = ICON_MAP[a.icon] || Trophy;
            return (
              <div
                key={a.id}
                className={`rounded-2xl p-5 border ${a.unlocked ? "glass border-[#BAFB00]/30" : "bg-white/[0.02] border-white/5 opacity-60"}`}
                data-testid={`achievement-${a.id}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.unlocked ? "bg-[#BAFB00]/10 border border-[#BAFB00]/30" : "bg-white/5 border border-white/10"}`}>
                  {a.unlocked ? <Icon className="w-5 h-5 text-[#BAFB00]" /> : <Lock className="w-4 h-4 text-zinc-500" />}
                </div>
                <h3 className="mt-4 font-display font-bold text-base">{a.title}</h3>
                <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{a.description}</p>
                <p className="mt-3 font-mono-label text-[10px] text-[#BAFB00]">{a.unlocked ? "Unlocked" : "Locked"}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
