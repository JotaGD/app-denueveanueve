import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type Locale = 'es' | 'en';

const translations: Record<Locale, Record<string, string>> = {
  es: {
    // Nav
    'nav.home': 'Inicio',
    'nav.book': 'Reservar',
    'nav.appointments': 'Citas',
    'nav.loyalty': 'Fidelidad',
    'nav.profile': 'Perfil',
    // Welcome
    'welcome.title': 'Bienvenido a',
    'welcome.subtitle': 'Peluquería y Estética Premium',
    'welcome.cta': 'Empezar',
    'welcome.login': 'Ya tengo cuenta',
    // Auth
    'auth.register': 'Crear cuenta',
    'auth.login': 'Iniciar sesión',
    'auth.email': 'Correo electrónico',
    'auth.password': 'Contraseña',
    'auth.name': 'Nombre',
    'auth.surname': 'Apellidos',
    'auth.phone': 'Teléfono',
    'auth.terms': 'Acepto los términos y condiciones',
    'auth.marketing': 'Acepto recibir comunicaciones comerciales',
    'auth.whatsapp': 'Acepto recibir mensajes por WhatsApp',
    'auth.submit': 'Continuar',
    'auth.hasAccount': '¿Ya tienes cuenta?',
    'auth.noAccount': '¿No tienes cuenta?',
    'auth.forgotPassword': '¿Olvidaste tu contraseña?',
    // Home
    'home.greeting': 'Hola',
    'home.nextAppointment': 'Próxima cita',
    'home.noAppointments': 'Sin citas próximas',
    'home.bookNow': 'Reservar ahora',
    'home.loyalty': 'Tu fidelidad',
    'home.points': 'puntos',
    'home.visits': 'visitas',
    'home.club': 'Club Premium',
    'home.promos': 'Promociones',
    'home.welcomeCoupon': 'Cupón de bienvenida',
    'home.couponDesc': '5% de descuento en tu primera visita',
    // General
    'general.loading': 'Cargando...',
    'general.error': 'Ha ocurrido un error',
    'general.retry': 'Reintentar',
    'general.save': 'Guardar',
    'general.cancel': 'Cancelar',
    'general.back': 'Volver',
    'general.language': 'Idioma',
  },
  en: {
    'nav.home': 'Home',
    'nav.book': 'Book',
    'nav.appointments': 'Appointments',
    'nav.loyalty': 'Loyalty',
    'nav.profile': 'Profile',
    'welcome.title': 'Welcome to',
    'welcome.subtitle': 'Premium Hair & Beauty Salon',
    'welcome.cta': 'Get Started',
    'welcome.login': 'I have an account',
    'auth.register': 'Create account',
    'auth.login': 'Log in',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.name': 'First name',
    'auth.surname': 'Last name',
    'auth.phone': 'Phone',
    'auth.terms': 'I accept the terms and conditions',
    'auth.marketing': 'I accept marketing communications',
    'auth.whatsapp': 'I accept WhatsApp messages',
    'auth.submit': 'Continue',
    'auth.hasAccount': 'Already have an account?',
    'auth.noAccount': "Don't have an account?",
    'auth.forgotPassword': 'Forgot your password?',
    'home.greeting': 'Hello',
    'home.nextAppointment': 'Next appointment',
    'home.noAppointments': 'No upcoming appointments',
    'home.bookNow': 'Book now',
    'home.loyalty': 'Your loyalty',
    'home.points': 'points',
    'home.visits': 'visits',
    'home.club': 'Premium Club',
    'home.promos': 'Promotions',
    'home.welcomeCoupon': 'Welcome coupon',
    'home.couponDesc': '5% off your first visit',
    'general.loading': 'Loading...',
    'general.error': 'An error occurred',
    'general.retry': 'Retry',
    'general.save': 'Save',
    'general.cancel': 'Cancel',
    'general.back': 'Back',
    'general.language': 'Language',
  },
};

interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'es',
  setLocale: () => {},
  t: (key) => key,
});

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = localStorage.getItem('dn9n9-locale');
    return (saved === 'en' ? 'en' : 'es') as Locale;
  });

  const handleSetLocale = useCallback((l: Locale) => {
    setLocale(l);
    localStorage.setItem('dn9n9-locale', l);
  }, []);

  const t = useCallback((key: string) => {
    return translations[locale][key] || key;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale: handleSetLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
