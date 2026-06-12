import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Plus, Users, X, Copy, Check, Loader2, Hash } from "lucide-react";
import { toast } from "sonner";

function CreateModal({ open, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("⚔️");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="circle-create-modal">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-strong rounded-3xl p-6 md:p-8 w-full max-w-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-extrabold text-2xl tracking-tight">Create circle</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white" data-testid="circle-create-close-btn"><X className="w-5 h-5" /></button>
        </div>
        <div className="mt-6 space-y-4">
          <div>
            <label className="font-mono-label text-[10px] text-zinc-400">Emoji</label>
            <input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} className="mt-2 w-20 px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[#BAFB00] focus:outline-none text-2xl text-center" data-testid="circle-emoji-input" />
          </div>
          <div>
            <label className="font-mono-label text-[10px] text-zinc-400">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[#BAFB00] focus:outline-none text-white" data-testid="circle-name-input" placeholder="Shadow Guild" />
          </div>
          <div>
            <label className="font-mono-label text-[10px] text-zinc-400">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-2 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[#BAFB00] focus:outline-none text-white resize-none" data-testid="circle-description-input" />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-5 py-2.5 rounded-full glass text-zinc-300 hover:bg-white/10 text-sm">Cancel</button>
          <button
            onClick={async () => {
              if (!name.trim()) return toast.error("Name required");
              setSaving(true);
              try {
                const { data } = await api.post("/circles", { name, description, emoji });
                toast.success(`Circle created · code ${data.invite_code}`);
                onCreated(data);
                onClose();
              } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
              finally { setSaving(false); }
            }}
            disabled={saving}
            className="px-5 py-2.5 rounded-full bg-[#BAFB00] text-black font-bold hover:bg-[#A3E635] text-sm disabled:opacity-50 inline-flex items-center gap-2"
            data-testid="circle-create-submit-btn"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Create
          </button>
        </div>
      </div>
    </div>
  );
}

function JoinModal({ open, onClose, onJoined }) {
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="circle-join-modal">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-strong rounded-3xl p-6 md:p-8 w-full max-w-md">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-extrabold text-2xl tracking-tight">Join circle</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="mt-6">
          <label className="font-mono-label text-[10px] text-zinc-400">Invite code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="mt-2 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[#BAFB00] focus:outline-none text-white font-mono tracking-widest text-center text-lg"
            placeholder="SHADOW01"
            data-testid="circle-join-code-input"
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-5 py-2.5 rounded-full glass text-zinc-300 hover:bg-white/10 text-sm">Cancel</button>
          <button
            onClick={async () => {
              if (!code.trim()) return toast.error("Code required");
              setSaving(true);
              try {
                const { data } = await api.post("/circles/join", { invite_code: code.trim() });
                toast.success(`Joined ${data.name}`);
                onJoined(data);
                onClose();
              } catch (e) { toast.error(e.response?.data?.detail || "Invalid code"); }
              finally { setSaving(false); }
            }}
            disabled={saving}
            className="px-5 py-2.5 rounded-full bg-[#BAFB00] text-black font-bold hover:bg-[#A3E635] text-sm disabled:opacity-50 inline-flex items-center gap-2"
            data-testid="circle-join-submit-btn"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Join
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Circles() {
  const [circles, setCircles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [copied, setCopied] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/circles");
      setCircles(data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const copyCode = async (code, id) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch { toast.error("Copy failed"); }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto animate-fade-up" data-testid="circles-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="font-mono-label text-[10px] text-[#BAFB00]">// Circles</p>
          <h1 className="font-display font-black text-4xl sm:text-5xl tracking-[-0.02em] mt-2">Your circles</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setJoinOpen(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full glass text-zinc-200 hover:bg-white/10 text-sm" data-testid="circles-join-btn">
            <Hash className="w-4 h-4" /> Join with code
          </button>
          <button onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#BAFB00] text-black font-bold hover:bg-[#A3E635] text-sm" data-testid="circles-create-btn">
            <Plus className="w-4 h-4" /> Create circle
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#BAFB00]" /></div>
      ) : circles.length === 0 ? (
        <div className="mt-8 glass rounded-3xl p-12 text-center">
          <Users className="w-10 h-10 text-zinc-600 mx-auto" />
          <p className="mt-4 text-zinc-400">No circles yet. Create one or join with a code.</p>
        </div>
      ) : (
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {circles.map((c) => (
            <div key={c.id} className="glass rounded-2xl p-6 flex flex-col" data-testid={`circle-card-${c.id}`}>
              <div className="flex items-start justify-between">
                <span className="text-4xl">{c.emoji}</span>
                <button
                  onClick={() => copyCode(c.invite_code, c.id)}
                  className="font-mono-label text-[10px] text-[#BAFB00] inline-flex items-center gap-1 hover:text-[#A3E635]"
                  data-testid={`circle-copy-code-${c.id}`}
                >
                  {copied === c.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {c.invite_code}
                </button>
              </div>
              <h3 className="mt-4 font-display font-bold text-xl">{c.name}</h3>
              {c.description && <p className="mt-1 text-sm text-zinc-400 line-clamp-2">{c.description}</p>}
              <div className="mt-auto pt-4 flex items-center justify-between">
                <p className="font-mono-label text-[10px] text-zinc-500">{c.members.length} members</p>
                <Link to={`/circles/${c.id}`} className="text-sm text-[#BAFB00] hover:text-[#A3E635]" data-testid={`circle-open-${c.id}`}>Open →</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(c) => setCircles((arr) => [...arr, c])} />
      <JoinModal open={joinOpen} onClose={() => setJoinOpen(false)} onJoined={(c) => setCircles((arr) => arr.find(x => x.id === c.id) ? arr : [...arr, c])} />
    </div>
  );
}
