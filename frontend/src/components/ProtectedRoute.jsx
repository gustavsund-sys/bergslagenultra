import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export const ProtectedRoute = ({ children }) => {
  const { user, checked } = useAuth();
  if (!checked || user === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/admin/login" replace />;
  return children;
};
