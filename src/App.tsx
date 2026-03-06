import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import Index from "./pages/Index";
import Welcome from "./pages/Welcome";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Home from "./pages/Home";
import PlaceholderPage from "./pages/PlaceholderPage";
import NotFound from "./pages/NotFound";
import { CalendarPlus, CalendarDays, Star, User, Crown, Tag } from "lucide-react";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<Login />} />
              <Route path="/home" element={<Home />} />
              <Route path="/book" element={<PlaceholderPage title="Reservar" icon={<CalendarPlus size={32} />} />} />
              <Route path="/appointments" element={<PlaceholderPage title="Mis Citas" icon={<CalendarDays size={32} />} />} />
              <Route path="/loyalty" element={<PlaceholderPage title="Fidelidad" icon={<Star size={32} />} />} />
              <Route path="/profile" element={<PlaceholderPage title="Mi Perfil" icon={<User size={32} />} />} />
              <Route path="/club" element={<PlaceholderPage title="Club Premium" icon={<Crown size={32} />} />} />
              <Route path="/promos" element={<PlaceholderPage title="Promociones" icon={<Tag size={32} />} />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
