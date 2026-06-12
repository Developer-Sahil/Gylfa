import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, relativeTime } from "@/lib/api";
import { Crown, Copy, Check, Users, Zap, Flame, Activity as ActivityIcon, ChevronLeft, Loader2 } from "lucide-react";

export default function CircleDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get(`/circles/${id}`).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [id]);

  const copy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#BAFB00]" /></div>;
  if (!data) return <div className="p-10">Circle not found.</div>;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto animate-fade-up" data-testid="circle-detail-page">
      <Link to="/circles" className="font-mono-label text-[10px] text-zinc-400 hover:text-[#BAFB00] inline-flex items-center gap-1" data-testid="back-to-circles-link">
        <ChevronLeft className="w-3 h-3" /> Back
      </Link>

      <div className="mt-4 glass rounded-3xl p-6 md:p-10 relative grain" data-testid="circle-hero">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-4xl">{data.emoji}</div>
            <div>
              <p className="font-mono-label text-[10px] text-[#BAFB00]">// Circle</p>
              <h1 className="mt-1 font-display font-black text-3xl sm:text-4xl tracking-[-0.02em]">{data.name}</h1>
              <p className="mt-2 text-zinc-400 max-w-xl">{data.description}</p>
            </div>
          </div>
          <button onClick={copy} className="px-4 py-2 rounded-full glass inline-flex items-center gap-2 hover:bg-white/10" data-testid="circle-detail-copy-code">
            {copied ? <Check className="w-3.5 h-3.5 text-[#BAFB00]" /> : <Copy className="w-3.5 h-3.5 text-[#BAFB00]" />}
            <span className="font-mono tracking-widest text-sm">{data.invite_code}</span>
          </button>
        </div>

        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4" data-testid="circle-stat-members">
            <div className="flex items-center justify-between"><p className="font-mono-label text-[10px] text-zinc-400">Members</p><Users className="w-3.5 h-3.5 text-[#BAFB00]" /></div>
            <p className="mt-2 font-display font-black text-3xl">{data.stats.members}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4" data-testid="circle-stat-xp">
            <div className="flex items-center justify-between"><p className="font-mono-label text-[10px] text-zinc-400">Total XP</p><Zap className="w-3.5 h-3.5 text-[#BAFB00]" /></div>
            <p className="mt-2 font-display font-black text-3xl">{data.stats.total_xp.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4" data-testid="circle-stat-checkins">
            <div className="flex items-center justify-between"><p className="font-mono-label text-[10px] text-zinc-400">Check-ins</p><ActivityIcon className="w-3.5 h-3.5 text-[#BAFB00]" /></div>
            <p className="mt-2 font-display font-black text-3xl">{data.stats.total_checkins}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4" data-testid="circle-stat-streak">
            <div className="flex items-center justify-between"><p className="font-mono-label text-[10px] text-zinc-400">Avg Streak</p><Flame className="w-3.5 h-3.5 text-[#BAFB00]" /></div>
            <p className="mt-2 font-display font-black text-3xl">{data.stats.avg_streak}<span className="text-zinc-500 text-xl">d</span></p>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <section className="lg:col-span-2" data-testid="leaderboard">
          <h2 className="font-display font-extrabold text-2xl tracking-tight">Leaderboard</h2>
          <div className="mt-4 glass rounded-2xl divide-y divide-white/5 overflow-hidden">
            {data.leaderboard.map((m, idx) => (
              <div key={m.id} className="px-5 py-4 flex items-center gap-4" data-testid={`leaderboard-row-${idx}`}>
                <div className="w-8 font-mono-label text-xs text-zinc-500 text-center">{idx + 1}</div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/15 to-white/5 border border-white/10 flex items-center justify-center text-sm font-bold">{m.avatar?.slice?.(0, 2)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate flex items-center gap-2">
                    {m.name}
                    {idx === 0 && <Crown className="w-4 h-4 text-[#BAFB00]" data-testid="crown-icon" />}
                  </p>
                  <p className="font-mono-label text-[10px] text-zinc-500">Lv.{m.level} {m.title} · {m.streak}d streak</p>
                </div>
                <div className="text-right">
                  <p className="font-display font-black text-xl text-[#BAFB00]">{m.xp.toLocaleString()}</p>
                  <p className="font-mono-label text-[10px] text-zinc-500">XP</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Activity */}
        <section data-testid="activity-feed">
          <h2 className="font-display font-extrabold text-2xl tracking-tight">Activity</h2>
          <div className="mt-4 glass rounded-2xl p-5 space-y-3 max-h-[34rem] overflow-y-auto">
            {data.activities.length === 0 ? (
              <p className="text-sm text-zinc-500">No activity yet.</p>
            ) : (
              data.activities.map((a) => (
                <div key={a.id} className="flex items-start gap-3" data-testid={`activity-${a.id}`}>
                  <div className="w-8 h-8 rounded-full bg-[#BAFB00]/10 border border-[#BAFB00]/30 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-3.5 h-3.5 text-[#BAFB00]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white"><span className="font-medium">{a.user_name}</span> <span className="text-zinc-400">{a.message}</span></p>
                    <p className="font-mono-label text-[10px] text-zinc-500 mt-0.5">{relativeTime(a.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
