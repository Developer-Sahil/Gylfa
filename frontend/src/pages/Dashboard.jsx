import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, relativeTime } from "@/lib/api";
import XPRing from "@/components/XPRing";
import { Circle, CheckCircle2, Flame, Users, Award, Loader2, Zap, Trophy, Sparkles } from "lucide-react";
import { toast } from "sonner";

function xpForLevel(n) { return 50 * (n - 1) * n; }

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const [goals, setGoals] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [circles, setCircles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    try {
      const [g, c, ci] = await Promise.all([
        api.get("/goals"),
        api.get("/checkins"),
        api.get("/circles"),
      ]);
      setGoals(g.data);
      setCheckins(c.data);
      setCircles(ci.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (!user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#BAFB00]" />
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const isCompletedToday = (g) => g.last_completed_date === today;

  const dailyGoals = goals.filter((g) => g.frequency === "daily");
  const weeklyGoals = goals.filter((g) => g.frequency === "weekly");

  const handleCheck = async (goal) => {
    if (isCompletedToday(goal)) return;
    setBusy(goal.id);
    try {
      const { data } = await api.post("/checkins", { goal_id: goal.id });
      toast.success(`+${data.xp_earned} XP — ${goal.title}`, { description: data.leveled_up ? `Level up! Lv.${data.user.level} ${data.user.title}` : undefined });
      await load();
      await refreshUser();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Check-in failed");
    } finally {
      setBusy(null);
    }
  };

  const level = user.level;
  const prevXp = xpForLevel(level);
  const nextXp = xpForLevel(level + 1);
  const xpToNext = nextXp - user.xp;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto animate-fade-up" data-testid="dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="font-mono-label text-[10px] text-[#BAFB00]">// Today · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</p>
          <h1 className="font-display font-black text-4xl sm:text-5xl tracking-[-0.02em] mt-2">
            Hello, <span className="text-[#BAFB00]">{user.name.split(" ")[0]}</span>.
          </h1>
        </div>
      </div>

      {/* XP block */}
      <div className="mt-8 glass rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-8" data-testid="xp-block">
        <XPRing xp={user.xp} prevXp={prevXp} nextXp={nextXp} level={level} />
        <div className="flex-1 w-full">
          <p className="font-mono-label text-[10px] text-zinc-400">// Class</p>
          <p className="font-display font-black text-3xl mt-1">{user.title}</p>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-display font-black text-2xl text-[#BAFB00]" data-testid="user-xp">{user.xp.toLocaleString()}</span>
            <span className="font-mono-label text-[10px] text-zinc-400">XP / {nextXp.toLocaleString()} XP to Lv.{level + 1}</span>
          </div>
          <div className="mt-3 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#BAFB00] transition-all duration-1000"
              style={{ width: `${Math.min(100, ((user.xp - prevXp) / (nextXp - prevXp)) * 100)}%`, boxShadow: "0 0 10px rgba(186,251,0,0.6)" }}
              data-testid="xp-progress-bar"
            />
          </div>
          <p className="mt-2 font-mono-label text-[10px] text-zinc-500">{xpToNext.toLocaleString()} XP until next level</p>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-5" data-testid="stat-streak">
          <div className="flex items-center justify-between">
            <p className="font-mono-label text-[10px] text-zinc-400">Streak</p>
            <Flame className="w-4 h-4 text-[#BAFB00]" />
          </div>
          <p className="font-display font-black text-4xl mt-3">{user.streak}<span className="text-zinc-500 text-2xl">d</span></p>
          <p className="font-mono-label text-[10px] text-zinc-500 mt-2">Longest · {user.longest_streak}d</p>
        </div>
        <div className="glass rounded-2xl p-5" data-testid="stat-title">
          <div className="flex items-center justify-between">
            <p className="font-mono-label text-[10px] text-zinc-400">Title</p>
            <Award className="w-4 h-4 text-[#BAFB00]" />
          </div>
          <p className="font-display font-black text-3xl mt-3">{user.title}</p>
          <p className="font-mono-label text-[10px] text-zinc-500 mt-2">Level · {user.level}</p>
        </div>
        <div className="glass rounded-2xl p-5" data-testid="stat-circles">
          <div className="flex items-center justify-between">
            <p className="font-mono-label text-[10px] text-zinc-400">Circles</p>
            <Users className="w-4 h-4 text-[#BAFB00]" />
          </div>
          <p className="font-display font-black text-4xl mt-3">{circles.length}</p>
          <p className="font-mono-label text-[10px] text-zinc-500 mt-2">Pack count</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section data-testid="daily-quests">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-extrabold text-2xl tracking-tight">Daily quests</h2>
              <Link to="/goals" className="font-mono-label text-[10px] text-[#BAFB00] hover:text-[#A3E635]">Manage</Link>
            </div>
            <div className="mt-4 space-y-2">
              {dailyGoals.length === 0 ? (
                <div className="glass rounded-2xl p-6 text-center">
                  <p className="text-zinc-400 text-sm">No daily quests yet.</p>
                  <Link to="/goals" className="mt-3 inline-block font-mono-label text-[10px] text-[#BAFB00]">Add one →</Link>
                </div>
              ) : (
                dailyGoals.map((g) => {
                  const done = isCompletedToday(g);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => handleCheck(g)}
                      disabled={done || busy === g.id}
                      className={`w-full text-left glass rounded-2xl px-5 py-4 flex items-center gap-4 transition-all ${
                        done ? "opacity-60" : "hover:bg-white/[0.06]"
                      }`}
                      data-testid={`quest-toggle-${g.id}`}
                    >
                      {busy === g.id ? (
                        <Loader2 className="w-6 h-6 animate-spin text-[#BAFB00]" />
                      ) : done ? (
                        <CheckCircle2 className="w-6 h-6 text-[#BAFB00]" />
                      ) : (
                        <Circle className="w-6 h-6 text-zinc-500" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium ${done ? "line-through text-zinc-500" : "text-white"}`}>{g.title}</p>
                        {g.description && <p className="text-xs text-zinc-500 truncate">{g.description}</p>}
                      </div>
                      <span className="px-3 py-1 rounded-full bg-[#BAFB00]/10 border border-[#BAFB00]/30 font-mono-label text-[10px] text-[#BAFB00]">
                        +{g.xp_reward} XP
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section data-testid="weekly-missions">
            <h2 className="font-display font-extrabold text-2xl tracking-tight">Weekly missions</h2>
            <div className="mt-4 space-y-2">
              {weeklyGoals.length === 0 ? (
                <div className="glass rounded-2xl p-6 text-center text-sm text-zinc-400">No weekly missions.</div>
              ) : (
                weeklyGoals.map((g) => {
                  const done = isCompletedToday(g);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => handleCheck(g)}
                      disabled={done || busy === g.id}
                      className={`w-full text-left glass rounded-2xl px-5 py-4 flex items-center gap-4 transition-all ${
                        done ? "opacity-60" : "hover:bg-white/[0.06]"
                      }`}
                      data-testid={`weekly-toggle-${g.id}`}
                    >
                      {busy === g.id ? (
                        <Loader2 className="w-6 h-6 animate-spin text-[#BAFB00]" />
                      ) : done ? (
                        <CheckCircle2 className="w-6 h-6 text-[#BAFB00]" />
                      ) : (
                        <Circle className="w-6 h-6 text-zinc-500" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium ${done ? "line-through text-zinc-500" : "text-white"}`}>{g.title}</p>
                        {g.description && <p className="text-xs text-zinc-500 truncate">{g.description}</p>}
                      </div>
                      <span className="px-3 py-1 rounded-full bg-[#BAFB00]/10 border border-[#BAFB00]/30 font-mono-label text-[10px] text-[#BAFB00]">
                        +{g.xp_reward} XP
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* Side panel */}
        <aside className="space-y-6">
          <div className="glass rounded-2xl p-5" data-testid="recent-checkins">
            <h3 className="font-display font-bold text-lg">Recent check-ins</h3>
            <div className="mt-3 space-y-3 max-h-72 overflow-y-auto">
              {checkins.length === 0 ? (
                <p className="text-sm text-zinc-500">No check-ins yet.</p>
              ) : (
                checkins.slice(0, 8).map((c) => (
                  <div key={c.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#BAFB00]/10 border border-[#BAFB00]/30 flex items-center justify-center flex-shrink-0">
                      <Zap className="w-3.5 h-3.5 text-[#BAFB00]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{c.goal_title}</p>
                      <p className="font-mono-label text-[10px] text-zinc-500">+{c.xp_earned} XP · {relativeTime(c.created_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="glass rounded-2xl p-5" data-testid="circles-list">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg">Your circles</h3>
              <Link to="/circles" className="font-mono-label text-[10px] text-[#BAFB00]">View →</Link>
            </div>
            <div className="mt-3 space-y-2">
              {circles.length === 0 ? (
                <p className="text-sm text-zinc-500">No circles yet.</p>
              ) : (
                circles.map((c) => (
                  <Link key={c.id} to={`/circles/${c.id}`} className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-white/[0.04]" data-testid={`circle-link-${c.id}`}>
                    <span className="text-2xl">{c.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="font-mono-label text-[10px] text-zinc-500">{c.members.length} members</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
