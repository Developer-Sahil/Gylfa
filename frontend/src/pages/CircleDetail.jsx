import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, relativeTime } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  Crown, Copy, Check, Users, Zap, Flame, Activity as ActivityIcon, ChevronLeft,
  Loader2, ShieldCheck, MoreHorizontal, UserPlus, UserMinus, ArrowUpRight, X, Mail, Send,
} from "lucide-react";
import { toast } from "sonner";

const PERIODS = [
  { key: "all", label: "All-time" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
];

function InviteModal({ open, onClose, circleId, inviteCode }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;

  const send = async () => {
    const emails = text
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
    if (emails.length === 0) return toast.error("Add at least one valid email");
    setBusy(true);
    try {
      const { data } = await api.post(`/circles/${circleId}/invite`, { emails });
      toast.success(`Sent ${data.sent} invite${data.sent === 1 ? "" : "s"}`);
      setText("");
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to send");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="invite-modal">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-strong rounded-3xl p-6 md:p-8 w-full max-w-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-extrabold text-2xl tracking-tight">Invite to circle</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white" data-testid="invite-modal-close-btn"><X className="w-5 h-5" /></button>
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          Recipients get the invite code <span className="font-mono text-[#BAFB00]">{inviteCode}</span> by email.
        </p>
        <div className="mt-5">
          <label className="font-mono-label text-[10px] text-zinc-400">Emails (comma or newline separated)</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="mt-2 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[#BAFB00] focus:outline-none text-white resize-none font-mono text-sm"
            placeholder="kai@example.com, lyra@example.com"
            data-testid="invite-emails-input"
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-5 py-2.5 rounded-full glass text-zinc-300 hover:bg-white/10 text-sm">Cancel</button>
          <button
            onClick={send}
            disabled={busy}
            className="px-5 py-2.5 rounded-full bg-[#BAFB00] text-black font-bold hover:bg-[#A3E635] text-sm disabled:opacity-50 inline-flex items-center gap-2"
            data-testid="invite-submit-btn"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send invites
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberMenu({ member, myRole, ownerId, onPromote, onDemote, onRemove }) {
  const [open, setOpen] = useState(false);
  const canManage = myRole === "owner" || (myRole === "admin" && member.role === "member");
  if (!canManage || member.role === "owner") return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="p-2 rounded-full hover:bg-white/5 text-zinc-300"
        data-testid={`member-menu-btn-${member.id}`}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 glass-strong rounded-xl overflow-hidden z-20" data-testid={`member-menu-${member.id}`}>
          {myRole === "owner" && member.role === "member" && (
            <button onClick={() => { setOpen(false); onPromote(member); }} className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 flex items-center gap-2" data-testid={`promote-btn-${member.id}`}>
              <UserPlus className="w-3.5 h-3.5 text-[#BAFB00]" /> Promote to admin
            </button>
          )}
          {myRole === "owner" && member.role === "admin" && (
            <button onClick={() => { setOpen(false); onDemote(member); }} className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 flex items-center gap-2" data-testid={`demote-btn-${member.id}`}>
              <UserMinus className="w-3.5 h-3.5 text-zinc-300" /> Demote to member
            </button>
          )}
          <button onClick={() => { setOpen(false); onRemove(member); }} className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 flex items-center gap-2 text-red-400" data-testid={`remove-btn-${member.id}`}>
            <UserMinus className="w-3.5 h-3.5" /> Remove from circle
          </button>
        </div>
      )}
    </div>
  );
}

function RoleBadge({ role }) {
  if (role === "owner") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#BAFB00]/10 border border-[#BAFB00]/30 font-mono-label text-[9px] text-[#BAFB00]" data-testid="role-badge-owner">
        <Crown className="w-2.5 h-2.5" /> Owner
      </span>
    );
  }
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/5 border border-white/15 font-mono-label text-[9px] text-zinc-200" data-testid="role-badge-admin">
        <ShieldCheck className="w-2.5 h-2.5" /> Admin
      </span>
    );
  }
  return null;
}

export default function CircleDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");
  const [copied, setCopied] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = async (p = period) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/circles/${id}?period=${p}`);
      setData(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(period); /* eslint-disable-next-line */ }, [id, period]);

  const copy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const promote = async (m) => {
    try { const { data: c } = await api.post(`/circles/${id}/members/${m.id}/promote`); toast.success(`${m.name} promoted to admin`); await load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const demote = async (m) => {
    try { await api.post(`/circles/${id}/members/${m.id}/demote`); toast.success(`${m.name} demoted to member`); await load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const remove = async (m) => {
    if (!window.confirm(`Remove ${m.name} from the circle?`)) return;
    try { await api.delete(`/circles/${id}/members/${m.id}`); toast.success(`${m.name} removed`); await load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  if (loading && !data) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#BAFB00]" /></div>;
  if (!data) return <div className="p-10">Circle not found.</div>;

  const myRole = data.my_role;

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
              <p className="font-mono-label text-[10px] text-[#BAFB00]">// Circle · You are {myRole}</p>
              <h1 className="mt-1 font-display font-black text-3xl sm:text-4xl tracking-[-0.02em]">{data.name}</h1>
              <p className="mt-2 text-zinc-400 max-w-xl">{data.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={copy} className="px-4 py-2 rounded-full glass inline-flex items-center gap-2 hover:bg-white/10" data-testid="circle-detail-copy-code">
              {copied ? <Check className="w-3.5 h-3.5 text-[#BAFB00]" /> : <Copy className="w-3.5 h-3.5 text-[#BAFB00]" />}
              <span className="font-mono tracking-widest text-sm">{data.invite_code}</span>
            </button>
            {(myRole === "owner" || myRole === "admin") && (
              <button
                onClick={() => setInviteOpen(true)}
                className="px-4 py-2 rounded-full bg-[#BAFB00] text-black font-bold text-sm hover:bg-[#A3E635] inline-flex items-center gap-2"
                data-testid="invite-by-email-btn"
              >
                <Mail className="w-3.5 h-3.5" /> Invite by email
              </button>
            )}
          </div>
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
          <div className="flex items-end justify-between flex-wrap gap-3">
            <h2 className="font-display font-extrabold text-2xl tracking-tight">Leaderboard</h2>
            <div className="inline-flex glass rounded-full p-1" data-testid="leaderboard-period-tabs">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`px-4 py-1.5 rounded-full text-xs transition-colors ${period === p.key ? "bg-[#BAFB00] text-black font-bold" : "text-zinc-400 hover:text-white"}`}
                  data-testid={`period-tab-${p.key}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 glass rounded-2xl divide-y divide-white/5 overflow-hidden">
            {data.leaderboard.map((m, idx) => {
              const score = period === "all" ? m.xp : m.period_xp;
              return (
                <div key={m.id} className="px-5 py-4 flex items-center gap-4" data-testid={`leaderboard-row-${idx}`}>
                  <div className="w-8 font-mono-label text-xs text-zinc-500 text-center">{idx + 1}</div>
                  <Link to={`/u/${m.id}`} className="w-10 h-10 rounded-full bg-gradient-to-br from-white/15 to-white/5 border border-white/10 flex items-center justify-center text-sm font-bold hover:border-[#BAFB00]/40 transition-colors" data-testid={`member-avatar-${m.id}`}>
                    {m.avatar?.slice?.(0, 2)}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate flex items-center gap-2 flex-wrap">
                      <Link to={`/u/${m.id}`} className="hover:text-[#BAFB00] transition-colors" data-testid={`member-name-${m.id}`}>{m.name}</Link>
                      {idx === 0 && period === "all" && <Crown className="w-4 h-4 text-[#BAFB00]" data-testid="crown-icon" />}
                      <RoleBadge role={m.role} />
                    </p>
                    <p className="font-mono-label text-[10px] text-zinc-500">Lv.{m.level} {m.title} · {m.streak}d streak{period !== "all" && ` · ${m.period_checkins || 0} check-ins`}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-black text-xl text-[#BAFB00]">{(score || 0).toLocaleString()}</p>
                    <p className="font-mono-label text-[10px] text-zinc-500">{period === "all" ? "XP" : "PERIOD XP"}</p>
                  </div>
                  <MemberMenu
                    member={m}
                    myRole={myRole}
                    ownerId={data.owner_id}
                    onPromote={promote}
                    onDemote={demote}
                    onRemove={remove}
                  />
                </div>
              );
            })}
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
                    <p className="text-sm text-white">
                      <Link to={`/u/${a.user_id}`} className="font-medium hover:text-[#BAFB00] transition-colors">{a.user_name}</Link>{" "}
                      <span className="text-zinc-400">{a.message}</span>
                    </p>
                    <p className="font-mono-label text-[10px] text-zinc-500 mt-0.5">{relativeTime(a.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} circleId={id} inviteCode={data.invite_code} />
    </div>
  );
}
