import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import NotificationsBell from "@/components/NotificationsBell";
import { LayoutDashboard, Target, Users, User, LogOut, Menu, X, Sparkles } from "lucide-react";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/goals", label: "Goals", icon: Target, testid: "nav-goals" },
  { to: "/circles", label: "Circles", icon: Users, testid: "nav-circles" },
  { to: "/profile", label: "Profile", icon: User, testid: "nav-profile" },
];

function Sidebar({ onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };
  return (
    <aside className="h-full w-64 flex flex-col border-r border-white/10 bg-[#050505]" data-testid="sidebar">
      <div className="px-6 pt-8 pb-6 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2" data-testid="brand-link">
          <div className="w-8 h-8 rounded-md bg-[#BAFB00] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-black" />
          </div>
          <span className="font-display font-black text-2xl tracking-[-0.02em]">GYLFA</span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-zinc-400" data-testid="sidebar-close-btn">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="px-6 pb-4">
        <NotificationsBell />
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                isActive
                  ? "bg-white/5 text-white border border-white/10"
                  : "text-zinc-400 hover:text-white hover:bg-white/[0.03]"
              }`
            }
            data-testid={n.testid}
          >
            <n.icon className="w-4 h-4" />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="m-3 p-3 rounded-2xl glass" data-testid="sidebar-user-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/10 flex items-center justify-center text-sm font-bold">
            {user?.avatar?.slice?.(0, 2) || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="font-mono-label text-[10px] text-[#BAFB00]">Lv.{user?.level} · {user?.title}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-300 transition-colors"
          data-testid="logout-btn"
        >
          <LogOut className="w-3.5 h-3.5" /> Log out
        </button>
      </div>
    </aside>
  );
}

export default function AppLayout({ children }) {
  const [drawer, setDrawer] = useState(false);
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* mobile top bar */}
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-[#050505]/80 backdrop-blur-xl border-b border-white/10">
        <button onClick={() => setDrawer(true)} className="p-2 -ml-2" data-testid="mobile-menu-btn">
          <Menu className="w-5 h-5" />
        </button>
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[#BAFB00] flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-black" />
          </div>
          <span className="font-display font-black text-xl tracking-[-0.02em]">GYLFA</span>
        </Link>
        <NotificationsBell />
      </div>

      {/* desktop sidebar */}
      <div className="hidden md:block fixed inset-y-0 left-0 z-30">
        <Sidebar />
      </div>

      {/* mobile drawer */}
      {drawer && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-64">
            <Sidebar onClose={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <main className="md:ml-64 min-h-screen">{children}</main>
    </div>
  );
}
