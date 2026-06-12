import { useEffect, useRef, useState } from "react";
import { api, relativeTime } from "@/lib/api";
import { Bell, X, Trophy, Flame, Mail, CheckCheck } from "lucide-react";

function iconFor(type) {
  if (type === "level_up") return Trophy;
  if (type === "streak_milestone") return Flame;
  return Mail;
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const load = async () => {
    try {
      const { data } = await api.get("/notifications");
      setItems(data.items || []);
      setUnread(data.unread || 0);
    } catch {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const markOne = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    setItems((arr) => arr.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
  };

  const markAll = async () => {
    await api.post("/notifications/mark-all-read");
    setItems((arr) => arr.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:border-white/20 flex items-center justify-center transition-colors"
        data-testid="notifications-bell-btn"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4 text-zinc-200" />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#BAFB00] text-black text-[10px] font-bold flex items-center justify-center animate-pulse-ring"
            data-testid="notifications-unread-badge"
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 glass-strong rounded-2xl shadow-2xl z-50 overflow-hidden"
          data-testid="notifications-panel"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="font-mono-label text-xs text-zinc-300">Notifications</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={markAll}
                disabled={unread === 0}
                className="text-[11px] font-mono-label text-[#BAFB00] hover:text-[#A3E635] disabled:text-zinc-600 flex items-center gap-1"
                data-testid="mark-all-read-btn"
              >
                <CheckCheck className="w-3 h-3" /> Mark all
              </button>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white" data-testid="close-notifications-btn">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center" data-testid="notifications-empty">
                <p className="font-display text-lg text-white">All caught up.</p>
                <p className="text-xs text-zinc-400 mt-1">No new notifications.</p>
              </div>
            ) : (
              items.map((n) => {
                const Icon = iconFor(n.type);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => !n.read && markOne(n.id)}
                    className={`w-full text-left px-4 py-3 flex gap-3 items-start border-b border-white/5 hover:bg-white/[0.03] transition-colors ${
                      n.read ? "opacity-60" : ""
                    }`}
                    data-testid={`notification-item-${n.id}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-[#BAFB00]/10 border border-[#BAFB00]/30 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-[#BAFB00]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium leading-tight">{n.title}</p>
                      <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="font-mono-label text-[10px] text-zinc-500 mt-1">{relativeTime(n.created_at)}</p>
                    </div>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-[#BAFB00] mt-2 acid-glow" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
