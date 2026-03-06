import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, MapPin, Clock, ChevronRight, MessageCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import type { Tables } from '@/integrations/supabase/types';

type Appointment = Tables<'appointments'>;

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: 'bg-success/20 text-success',
  RESCHEDULED: 'bg-warning/20 text-warning',
  CANCELLED: 'bg-destructive/20 text-destructive',
  COMPLETED: 'bg-muted text-muted-foreground',
  NO_SHOW: 'bg-destructive/20 text-destructive',
};

const Appointments = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();

  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming');
  const [appointments, setAppointments] = useState<(Appointment & { location_name?: string; services_list?: string[] })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const loadAppointments = async () => {
      setLoading(true);
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!customer) { setLoading(false); return; }

      const now = new Date().toISOString();
      let query = supabase
        .from('appointments')
        .select('*')
        .eq('customer_id', customer.id);

      if (tab === 'upcoming') {
        query = query.in('status', ['CONFIRMED', 'RESCHEDULED']).gte('start_at', now).order('start_at', { ascending: true });
      } else {
        query = query.in('status', ['COMPLETED', 'CANCELLED', 'NO_SHOW']).order('start_at', { ascending: false });
      }

      const { data } = await query;

      if (data && data.length > 0) {
        // Fetch location names
        const locIds = [...new Set(data.map((a) => a.location_id))];
        const { data: locs } = await supabase.from('locations').select('id, name').in('id', locIds);
        const locMap = new Map(locs?.map((l) => [l.id, l.name]) || []);

        setAppointments(
          data.map((a) => ({ ...a, location_name: locMap.get(a.location_id) || '' }))
        );
      } else {
        setAppointments([]);
      }
      setLoading(false);
    };
    loadAppointments();
  }, [user, tab]);

  const handleCancel = async (id: string) => {
    if (!confirm(t('appointments.cancelConfirm'))) return;
    await supabase.from('appointments').update({ status: 'CANCELLED' }).eq('id', id);
    setAppointments((prev) => prev.filter((a) => a.id !== id));
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  };
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-6 pt-12 pb-4">
        <h1 className="font-display text-3xl text-foreground">{t('appointments.title')}</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mx-6 mb-4 rounded-lg bg-muted p-1">
        {(['upcoming', 'history'] as const).map((t2) => (
          <button
            key={t2}
            onClick={() => setTab(t2)}
            className={`flex-1 rounded-md py-2 text-xs font-medium transition-all ${
              tab === t2 ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {t(`appointments.${t2}`)}
          </button>
        ))}
      </div>

      <div className="px-6 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays className="mb-4 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">
              {tab === 'upcoming' ? t('appointments.noUpcoming') : t('appointments.noHistory')}
            </p>
            {tab === 'upcoming' && (
              <Button onClick={() => navigate('/book')} className="gradient-gold text-primary-foreground shadow-gold">
                {t('appointments.bookFirst')}
              </Button>
            )}
          </div>
        ) : (
          appointments.map((apt, i) => (
            <motion.div
              key={apt.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{formatDate(apt.start_at)}</p>
                  <p className="text-xs text-muted-foreground">{formatTime(apt.start_at)} — {formatTime(apt.end_at)}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[apt.status] || ''}`}>
                  {t(`appointments.status.${apt.status}`)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                <MapPin size={12} /> {apt.location_name}
              </div>
              {tab === 'upcoming' && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleCancel(apt.id)} className="text-xs">
                    {t('appointments.cancel')}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs text-gold" onClick={() => {}}>
                    <MessageCircle size={14} /> {t('appointments.whatsappManage')}
                  </Button>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Appointments;
