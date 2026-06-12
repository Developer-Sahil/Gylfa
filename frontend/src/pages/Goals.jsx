import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Plus, Trash2, Pencil, X, Target, Loader2 } from "lucide-react";
import { toast } from "sonner";

function GoalModal({ open, onClose, onSave, initial }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [frequency, setFrequency] = useState(initial?.frequency || "daily");
  const [xp, setXp] = useState(initial?.xp_reward || 30);
  const [icon, setIcon] = useState(initial?.icon || "target");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(initial?.title || "");
    setDescription(initial?.description || "");
    setFrequency(initial?.frequency || "daily");
    setXp(initial?.xp_reward || 30);
    setIcon(initial?.icon || "target");
  }, [initial, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="goal-modal">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-strong rounded-3xl p-6 md:p-8 w-full max-w-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-extrabold text-2xl tracking-tight">{initial ? "Edit quest" : "New quest"}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white" data-testid="goal-modal-close-btn"><X className="w-5 h-5" /></button>
        </div>
        <div className="mt-6 space-y-4">
          <div>
            <label className="font-mono-label text-[10px] text-zinc-400">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[#BAFB00] focus:outline-none text-white" data-testid="goal-title-input" placeholder="e.g., Morning workout" />
          </div>
          <div>
            <label className="font-mono-label text-[10px] text-zinc-400">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-2 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[#BAFB00] focus:outline-none text-white resize-none" data-testid="goal-description-input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono-label text-[10px] text-zinc-400">Frequency</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[#BAFB00] focus:outline-none text-white" data-testid="goal-frequency-select">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <div>
              <label className="font-mono-label text-[10px] text-zinc-400">XP reward</label>
              <input type="number" min={1} value={xp} onChange={(e) => setXp(parseInt(e.target.value || "0", 10))} className="mt-2 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-[#BAFB00] focus:outline-none text-white" data-testid="goal-xp-input" />
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-5 py-2.5 rounded-full glass text-zinc-300 hover:bg-white/10 text-sm" data-testid="goal-modal-cancel-btn">Cancel</button>
          <button
            onClick={async () => {
              if (!title.trim()) return toast.error("Title required");
              setSaving(true);
              try { await onSave({ title, description, frequency, xp_reward: xp, icon }); } finally { setSaving(false); }
            }}
            disabled={saving}
            className="px-5 py-2.5 rounded-full bg-[#BAFB00] text-black font-bold hover:bg-[#A3E635] text-sm disabled:opacity-50 inline-flex items-center gap-2"
            data-testid="goal-modal-save-btn"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [tab, setTab] = useState("daily");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data } = await api.get("/goals");
      setGoals(data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = goals.filter((g) => g.frequency === tab);

  const saveGoal = async (payload) => {
    try {
      if (editing) {
        await api.patch(`/goals/${editing.id}`, payload);
        toast.success("Quest updated");
      } else {
        await api.post("/goals", payload);
        toast.success("Quest created");
      }
      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Save failed");
    }
  };

  const deleteGoal = async (g) => {
    if (!window.confirm(`Delete "${g.title}"? This can't be undone.`)) return;
    try {
      await api.delete(`/goals/${g.id}`);
      toast.success("Quest deleted");
      await load();
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto animate-fade-up" data-testid="goals-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="font-mono-label text-[10px] text-[#BAFB00]">// Quests</p>
          <h1 className="font-display font-black text-4xl sm:text-5xl tracking-[-0.02em] mt-2">Your quests</h1>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#BAFB00] text-black font-bold hover:bg-[#A3E635] transition-colors"
          data-testid="goals-create-btn"
        >
          <Plus className="w-4 h-4" /> New quest
        </button>
      </div>

      <div className="mt-8 inline-flex glass rounded-full p-1">
        {[["daily","Daily"],["weekly","Weekly"]].map(([k,l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-5 py-2 rounded-full text-sm transition-colors ${tab === k ? "bg-[#BAFB00] text-black font-bold" : "text-zinc-400 hover:text-white"}`}
            data-testid={`goals-tab-${k}`}
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#BAFB00]" /></div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 glass rounded-3xl p-12 text-center">
          <Target className="w-10 h-10 text-zinc-600 mx-auto" />
          <p className="mt-4 text-zinc-400">No {tab} quests yet. Create your first.</p>
        </div>
      ) : (
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((g) => (
            <div key={g.id} className="glass rounded-2xl p-5 flex flex-col" data-testid={`goal-card-${g.id}`}>
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-[#BAFB00]/10 border border-[#BAFB00]/30 flex items-center justify-center">
                  <Target className="w-5 h-5 text-[#BAFB00]" />
                </div>
                <span className="font-mono-label text-[10px] text-[#BAFB00]">+{g.xp_reward} XP</span>
              </div>
              <h3 className="mt-4 font-display font-bold text-xl">{g.title}</h3>
              {g.description && <p className="mt-1 text-sm text-zinc-400 line-clamp-3">{g.description}</p>}
              <div className="mt-4 flex items-center justify-between">
                <p className="font-mono-label text-[10px] text-zinc-500">{g.total_completions} completions</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditing(g); setModalOpen(true); }} className="p-2 rounded-full hover:bg-white/5 text-zinc-300" data-testid={`goal-edit-btn-${g.id}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteGoal(g)} className="p-2 rounded-full hover:bg-white/5 text-zinc-300" data-testid={`goal-delete-btn-${g.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <GoalModal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} onSave={saveGoal} initial={editing} />
    </div>
  );
}
