import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import RequireAuth from "@/components/RequireAuth";
import PinOverlay from "@/components/PinOverlay";
import Index from "./pages/Index";
import Welcome from "./pages/Welcome";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Home from "./pages/Home";
import BookAppointment from "./pages/BookAppointment";
import Appointments from "./pages/Appointments";
import Loyalty from "./pages/Loyalty";
import Profile from "./pages/Profile";
import Club from "./pages/Club";
import Promos from "./pages/Promos";
import ServiceCatalog from "./pages/ServiceCatalog";
import PremiumBenefits from "./pages/PremiumBenefits";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <PinOverlay />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<Login />} />
              <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
              <Route path="/services" element={<RequireAuth><ServiceCatalog /></RequireAuth>} />
              <Route path="/book" element={<RequireAuth><BookAppointment /></RequireAuth>} />
              <Route path="/appointments" element={<RequireAuth><Appointments /></RequireAuth>} />
              <Route path="/loyalty" element={<RequireAuth><Loyalty /></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
              <Route path="/club" element={<RequireAuth><Club /></RequireAuth>} />
              <Route path="/promos" element={<RequireAuth><Promos /></RequireAuth>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
