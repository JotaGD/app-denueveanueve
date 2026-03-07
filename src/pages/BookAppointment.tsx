import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, Check, ChevronRight, CalendarDays, StickyNote, User, Scissors, Star, Euro } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import type { Tables } from '@/integrations/supabase/types';

type Location = Tables<'locations'>;
type Service = Tables<'services'>;
type StaffMember = Tables<'staff_members'>;
type ServiceCategory = Tables<'service_categories'>;

type SalonSection = 'CABALLEROS' | 'SENORAS' | 'ESTETICA';

const STEPS = ['location', 'section', 'staff', 'services', 'datetime', 'confirm'] as const;
type Step = typeof STEPS[number];

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30',
];

const formatPrice = (svc: Service) => {
  if (svc.price_type === 'on_request') return 'Consultar';
  if (svc.price_type === 'from_price') return `Desde ${svc.base_price?.toFixed(2)} €`;
  return `${svc.base_price?.toFixed(2)} €`;
};

const calcPoints = (svc: Service) => svc.fixed_points || (svc.base_price ? Math.ceil(svc.base_price / 2) : 0);

const BookAppointment = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('location');
  const [locations, setLocations] = useState<Location[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedSection, setSelectedSection] = useState<SalonSection | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const stepIndex = STEPS.indexOf(step);

  // Computed totals
  const totals = useMemo(() => {
    const duration = selectedServices.reduce((sum, s) => sum + (s.duration_min || 0), 0);
    const price = selectedServices.reduce((sum, s) => {
      if (s.price_type === 'on_request') return sum;
      return sum + (s.base_price || 0);
    }, 0);
    const points = selectedServices.reduce((sum, s) => sum + calcPoints(s), 0);
    const hasOnRequest = selectedServices.some((s) => s.price_type === 'on_request');
    return { duration, price, points, hasOnRequest };
  }, [selectedServices]);

  useEffect(() => {
    supabase.from('locations').select('*').then(({ data }) => {
      if (data) setLocations(data);
    });
  }, []);

  useEffect(() => {
    if (selectedLocation && selectedSection) {
      supabase
        .from('staff_members')
        .select('*')
        .eq('location_id', selectedLocation.id)
        .eq('section', selectedSection)
        .eq('active', true)
        .then(({ data }) => { if (data) setStaffMembers(data); });
    }
  }, [selectedLocation, selectedSection]);

  useEffect(() => {
    if (selectedLocation && selectedSection) {
      Promise.all([
        supabase
          .from('services')
          .select('*')
          .eq('active', true)
          .eq('section', selectedSection)
          .or(`location_id.eq.${selectedLocation.id},location_id.is.null`),
        supabase.from('service_categories').select('*').order('sort_order'),
      ]).then(([svcRes, catRes]) => {
        if (svcRes.data) setServices(svcRes.data);
        if (catRes.data) setCategories(catRes.data);
      });
    }
  }, [selectedLocation, selectedSection]);

  // Group services by category
  const servicesByCategory = useMemo(() => {
    const map = new Map<string, { category: ServiceCategory; services: Service[] }>();
    categories.forEach((cat) => {
      const catServices = services.filter((s) => s.category_id === cat.id);
      if (catServices.length > 0) map.set(cat.id, { category: cat, services: catServices });
    });
    // Uncategorized
    const uncategorized = services.filter((s) => !s.category_id);
    if (uncategorized.length > 0) {
      map.set('uncategorized', { category: { id: 'uncategorized', name: 'Otros', sort_order: 999, created_at: '' }, services: uncategorized });
    }
    return Array.from(map.values());
  }, [services, categories]);

  const handleConfirm = async () => {
    if (!selectedLocation || !selectedDate || !selectedTime || !user) return;
    setLoading(true);

    try {
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!customer) throw new Error('Customer not found');

      const [hours, minutes] = selectedTime.split(':').map(Number);
      const startAt = new Date(selectedDate);
      startAt.setHours(hours, minutes, 0, 0);
      const endAt = new Date(startAt.getTime() + totals.duration * 60000);

      const { data: appointment, error } = await supabase
        .from('appointments')
        .insert({
          customer_id: customer.id,
          location_id: selectedLocation.id,
          staff_member_id: selectedStaff?.id || null,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          customer_notes: notes || null,
          estimated_total_price: totals.price || null,
          estimated_total_duration: totals.duration || null,
          estimated_pending_points: totals.points || null,
        })
        .select()
        .single();

      if (error) throw error;

      if (appointment && selectedServices.length > 0) {
        await supabase.from('appointment_services').insert(
          selectedServices.map((s) => ({
            appointment_id: appointment.id,
            service_id: s.id,
            service_name_snapshot: s.name,
            price_type_snapshot: s.price_type,
            unit_price_snapshot: s.base_price,
            duration_minutes_snapshot: s.duration_min,
            points_snapshot: calcPoints(s),
            quantity: 1,
            is_completed: false,
          }))
        );
      }

      setSuccess(true);
    } catch (err) {
      console.error('Booking error:', err);
    } finally {
      setLoading(false);
    }
  };

  const canNext = () => {
    switch (step) {
      case 'location': return !!selectedLocation;
      case 'section': return !!selectedSection;
      case 'staff': return !!selectedStaff;
      case 'services': return selectedServices.length > 0;
      case 'datetime': return !!selectedDate && !!selectedTime;
      case 'confirm': return true;
    }
  };

  const goNext = () => { const i = STEPS.indexOf(step); if (i < STEPS.length - 1) setStep(STEPS[i + 1]); };
  const goPrev = () => {
    const i = STEPS.indexOf(step);
    if (i > 0) {
      if (step === 'staff') { setSelectedStaff(null); setSelectedServices([]); }
      if (step === 'services') { setSelectedServices([]); }
      if (step === 'section') { setSelectedSection(null); setSelectedStaff(null); setSelectedServices([]); }
      setStep(STEPS[i - 1]);
    }
  };

  const toggleService = (service: Service) => {
    setSelectedServices((prev) =>
      prev.find((s) => s.id === service.id)
        ? prev.filter((s) => s.id !== service.id)
        : [...prev, service]
    );
  };

  const handleSectionSelect = (section: SalonSection) => {
    setSelectedSection(section);
    setSelectedStaff(null);
    setSelectedServices([]);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center pb-24">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mb-6 flex h-20 w-20 items-center justify-center rounded-full gradient-gold">
          <Check className="h-10 w-10 text-primary-foreground" />
        </motion.div>
        <h1 className="font-display text-3xl text-foreground mb-2">{t('book.success')}</h1>
        <p className="text-sm text-muted-foreground mb-2">{t('book.successDesc')}</p>
        <div className="rounded-xl border border-gold/20 bg-gold/5 p-3 mb-6">
          <p className="text-xs text-gold flex items-center gap-1.5">
            <Star size={12} /> {t('book.pendingPointsNote')}: <span className="font-medium">{totals.points} pts</span>
          </p>
        </div>
        <Button onClick={() => navigate('/appointments')} className="gradient-gold text-primary-foreground shadow-gold">
          {t('book.goToAppointments')}
        </Button>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="px-6 pt-12 pb-4">
        <button onClick={() => (stepIndex > 0 ? goPrev() : navigate(-1))} className="mb-4 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={18} />
          <span className="text-sm">{stepIndex > 0 ? t('book.previous') : t('general.back')}</span>
        </button>
        <h1 className="font-display text-3xl text-foreground">{t('book.title')}</h1>
        <p className="text-xs text-muted-foreground mt-1">{t('book.step')} {stepIndex + 1} {t('book.of')} {STEPS.length}</p>
        <div className="mt-3 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= stepIndex ? 'gradient-gold' : 'bg-muted'}`} />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }} className="px-6 py-4">

          {/* Step 1: Location */}
          {step === 'location' && (
            <div className="space-y-3">
              <h2 className="text-lg font-display text-foreground mb-4">{t('book.selectLocation')}</h2>
              {locations.map((loc) => (
                <button key={loc.id} onClick={() => setSelectedLocation(loc)} className={`w-full rounded-xl border p-4 text-left transition-all ${selectedLocation?.id === loc.id ? 'border-gold bg-gold/5' : 'border-border bg-card hover:border-gold/20'}`}>
                  <div className="flex items-center gap-3">
                    <MapPin className={`h-5 w-5 ${selectedLocation?.id === loc.id ? 'text-gold' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{loc.name}</p>
                      <p className="text-xs text-muted-foreground">{loc.address}</p>
                    </div>
                    {selectedLocation?.id === loc.id && <Check className="ml-auto h-4 w-4 text-gold" />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Section */}
          {step === 'section' && (
            <div className="space-y-3">
              <h2 className="text-lg font-display text-foreground mb-4">{t('book.selectSection')}</h2>
              {(['CABALLEROS', 'SENORAS', 'ESTETICA'] as SalonSection[]).map((section) => (
                <button key={section} onClick={() => handleSectionSelect(section)} className={`w-full rounded-xl border p-5 text-left transition-all ${selectedSection === section ? 'border-gold bg-gold/5' : 'border-border bg-card hover:border-gold/20'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-full ${selectedSection === section ? 'gradient-gold' : 'bg-muted'}`}>
                      <Scissors className={`h-5 w-5 ${selectedSection === section ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className="text-base font-medium text-foreground">
                        {section === 'CABALLEROS' ? t('book.sectionMen') : section === 'SENORAS' ? t('book.sectionLadies') : t('book.sectionAesthetics')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {section === 'CABALLEROS' ? t('book.sectionMenDesc') : section === 'SENORAS' ? t('book.sectionLadiesDesc') : t('book.sectionAestheticsDesc')}
                      </p>
                    </div>
                    {selectedSection === section && <Check className="ml-auto h-4 w-4 text-gold" />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 3: Staff */}
          {step === 'staff' && (
            <div className="space-y-3">
              <h2 className="text-lg font-display text-foreground mb-4">{t('book.selectStaff')}</h2>
              {staffMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('book.noStaff')}</p>
              ) : staffMembers.map((member) => (
                <button key={member.id} onClick={() => setSelectedStaff(member)} className={`w-full rounded-xl border p-4 text-left transition-all ${selectedStaff?.id === member.id ? 'border-gold bg-gold/5' : 'border-border bg-card hover:border-gold/20'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${selectedStaff?.id === member.id ? 'gradient-gold' : 'bg-muted'}`}>
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt={member.name} className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <User className={`h-5 w-5 ${selectedStaff?.id === member.id ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground">{member.name}</p>
                    {selectedStaff?.id === member.id && <Check className="ml-auto h-4 w-4 text-gold" />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 4: Services */}
          {step === 'services' && (
            <div className="space-y-4">
              <h2 className="text-lg font-display text-foreground mb-2">{t('book.selectServices')}</h2>

              {servicesByCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('book.noServices')}</p>
              ) : (
                servicesByCategory.map(({ category, services: catServices }) => (
                  <div key={category.id}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{category.name}</p>
                    <div className="space-y-2">
                      {catServices.map((svc) => {
                        const isSelected = !!selectedServices.find((s) => s.id === svc.id);
                        return (
                          <button key={svc.id} onClick={() => toggleService(svc)} className={`w-full rounded-xl border p-3 text-left transition-all ${isSelected ? 'border-gold bg-gold/5' : 'border-border bg-card hover:border-gold/20'}`}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground">{svc.name}</p>
                                <div className="flex items-center gap-3 mt-1">
                                  {svc.duration_min && (
                                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                      <Clock size={10} /> {svc.duration_min} min
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1 text-[11px] text-gold">
                                    <Star size={10} /> {calcPoints(svc)} pts
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                <span className="text-xs font-medium text-gold whitespace-nowrap">{formatPrice(svc)}</span>
                                {isSelected && <Check className="h-4 w-4 text-gold" />}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}

              {/* Totals Summary */}
              {selectedServices.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-gold/20 bg-gold/5 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Clock size={12} /> {t('book.totalDuration')}</span>
                    <span className="text-foreground font-medium">{totals.duration} min</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Euro size={12} /> {t('book.estimatedPrice')}</span>
                    <span className="text-foreground font-medium">
                      {totals.hasOnRequest && '~'}{totals.price.toFixed(2)} €
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gold flex items-center gap-1.5"><Star size={12} /> {t('book.pendingPoints')}</span>
                    <span className="text-gold font-medium">{totals.points} pts</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{t('book.pendingPointsNote')}</p>
                </motion.div>
              )}
            </div>
          )}

          {/* Step 5: Date & Time */}
          {step === 'datetime' && (
            <div className="space-y-4">
              <h2 className="text-lg font-display text-foreground mb-2">{t('book.selectDate')}</h2>
              <div className="flex justify-center rounded-xl border border-border bg-card p-2">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => { setSelectedDate(d); setSelectedTime(null); }}
                  disabled={(date) => date < new Date() || date.getDay() === 0}
                  className="text-foreground pointer-events-auto"
                />
              </div>
              {selectedDate && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-foreground">{t('book.morning')}</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {TIME_SLOTS.filter((t) => parseInt(t) < 14).map((slot) => (
                      <button key={slot} onClick={() => setSelectedTime(slot)} className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${selectedTime === slot ? 'border-gold gradient-gold text-primary-foreground' : 'border-border bg-card text-foreground hover:border-gold/20'}`}>
                        {slot}
                      </button>
                    ))}
                  </div>
                  <h3 className="text-sm font-medium text-foreground mt-3">{t('book.afternoon')}</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {TIME_SLOTS.filter((t) => parseInt(t) >= 14).map((slot) => (
                      <button key={slot} onClick={() => setSelectedTime(slot)} className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${selectedTime === slot ? 'border-gold gradient-gold text-primary-foreground' : 'border-border bg-card text-foreground hover:border-gold/20'}`}>
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 6: Confirm */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <h2 className="text-lg font-display text-foreground mb-4">{t('book.confirm')}</h2>

              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-gold" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('appointments.location')}</p>
                    <p className="text-sm text-foreground">{selectedLocation?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Scissors className="h-4 w-4 text-gold" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('book.section')}</p>
                    <p className="text-sm text-foreground">
                      {selectedSection === 'CABALLEROS' ? t('book.sectionMen') : selectedSection === 'SENORAS' ? t('book.sectionLadies') : t('book.sectionAesthetics')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-gold" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('book.staff')}</p>
                    <p className="text-sm text-foreground">{selectedStaff?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-4 w-4 text-gold" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('appointments.date')}</p>
                    <p className="text-sm text-foreground">{selectedDate?.toLocaleDateString()} — {selectedTime}</p>
                  </div>
                </div>
              </div>

              {/* Services breakdown */}
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-2">{t('appointments.services')}</p>
                <div className="space-y-2">
                  {selectedServices.map((s) => (
                    <div key={s.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-foreground">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground">{s.duration_min ? `${s.duration_min} min` : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gold">{formatPrice(s)}</p>
                        <p className="text-[10px] text-gold/70">{calcPoints(s)} pts</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border mt-3 pt-3 space-y-1">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-muted-foreground">{t('book.total')}</span>
                    <span className="text-foreground">{totals.hasOnRequest && '~'}{totals.price.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-muted-foreground">{t('book.totalDuration')}</span>
                    <span className="text-foreground">{totals.duration} min</span>
                  </div>
                </div>
              </div>

              {/* Pending points callout */}
              <div className="rounded-xl border border-gold/20 bg-gold/5 p-3">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-gold" />
                  <div>
                    <p className="text-sm font-medium text-gold">{totals.points} {t('book.pointsToEarn')}</p>
                    <p className="text-[10px] text-muted-foreground">{t('book.pendingPointsNote')}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <StickyNote size={14} /> {t('book.notes')}
                </label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('book.notesPlaceholder')} className="bg-card border-border" />
              </div>

              <Button onClick={handleConfirm} disabled={loading} className="w-full gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
                {loading ? t('general.loading') : t('book.confirmBooking')}
              </Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Next button */}
      {step !== 'confirm' && (
        <div className="fixed bottom-24 left-0 right-0 px-6 pb-2 z-40">
          <Button onClick={goNext} disabled={!canNext()} className="w-full gradient-gold text-primary-foreground shadow-gold hover:opacity-90 disabled:opacity-40">
            {t('book.next')} <ChevronRight size={16} />
          </Button>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default BookAppointment;
