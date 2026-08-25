import "@/App.css";
import { HashRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Landing from "@/pages/Landing";
import Register from "@/pages/Register";
import StartList from "@/pages/StartList";
import Results from "@/pages/Results";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import BibLabels from "@/pages/BibLabels";
import LiveBoard from "@/pages/LiveBoard";
import LiveTiming from "@/pages/LiveTiming";
import EventSettings from "@/pages/EventSettings";

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/anmalan" element={<Register />} />
            <Route path="/startlista" element={<StartList />} />
            <Route path="/resultat" element={<Results />} />
            <Route path="/live" element={<LiveBoard />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/startnummer"
              element={
                <ProtectedRoute>
                  <BibLabels />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/timing"
              element={
                <ProtectedRoute>
                  <LiveTiming />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/installningar"
              element={
                <ProtectedRoute>
                  <EventSettings />
                </ProtectedRoute>
              }
            />
          </Routes>
        </HashRouter>
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </div>
  );
}

export default App;
