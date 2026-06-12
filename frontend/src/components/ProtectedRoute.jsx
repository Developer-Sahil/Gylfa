import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]" data-testid="auth-loading">
        <Loader2 className="w-6 h-6 animate-spin text-[#BAFB00]" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
