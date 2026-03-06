import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Crown, Check, Star, Scissors, Palette, CalendarCheck } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import type { Tables } from '@/integrations/supabase/types';

type Subscription = Tables<'subscriptions'>;

const STATUS_MAP: Record<string, string> = {
  ACTIVE: 'club.active',
  PAYMENT_DUE: 'club.paymentDue',
  CANCELLED_END_OF_PERIOD: 'club.cancelledEnd',
  EXPIRED: 'club.expired',
};

const PLANS = [
  {
    plan: 'LADIES_59' as const,
    nameKey: 'club.ladies',
    price: 59,
    benefits: ['club.ladiesBenefits.1', 'club.ladiesBenefits.2', 'club.ladiesBenefits.3', 'club.ladiesBenefits.4'],
    icons: [Scissors, Palette, CalendarCheck, Star],
  },
  {
    plan: 'MEN_19' as const,
    nameKey: 'club.men',
    price: 19,
    benefits: ['club.menBenefits.1', 'club.menBenefits.2', 'club.menBenefits.3'],
    icons: [Scissors, Star, CalendarCheck],
  },
];

const Club = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (customer) {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('customer_id', customer.id)
          .in('status', ['ACTIVE', 'PAYMENT_DUE', 'CANCELLED_END_OF_PERIOD'])
          .single();
        setSubscription(sub);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-6 pt-12 pb-4"><div className="h-8 w-40 animate-pulse rounded bg-muted" /></div>
        <div className="px-6 space-y-4">
          {[1, 2].map((i) => <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />)}
        </div>
        <BottomNav />
      </div>
    );
  }

  // Active subscription view
  if (subscription) {
    const planInfo = PLANS.find((p) => p.plan === subscription.plan);
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-6 pt-12 pb-4">
          <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
            <span className="text-sm">{t('general.back')}</span>
          </button>
          <h1 className="font-display text-3xl text-foreground">{t('club.title')}</h1>
        </div>

        <div className="px-6 space-y-4">
          {/* Status card */}
          <div className="rounded-xl border border-gold/20 bg-gradient-to-br from-gold/10 to-gold/5 p-5">
            <div className="flex items-center gap-3 mb-3">
              <Crown className="h-6 w-6 text-gold" />
              <div>
                <p className="text-lg font-display text-foreground">{planInfo ? t(planInfo.nameKey) : subscription.plan}</p>
                <span className="text-xs text-gold">{t(STATUS_MAP[subscription.status] || '')}</span>
              </div>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>{t('club.memberSince')}: {new Date(subscription.created_at).toLocaleDateString()}</p>
              {subscription.next_renewal_at && (
                <p>{t('club.nextRenewal')}: {new Date(subscription.next_renewal_at).toLocaleDateString()}</p>
              )}
            </div>
          </div>

          {/* Benefits */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-medium text-foreground mb-3">{t('club.benefits')}</h3>
            <div className="space-y-2">
              {planInfo?.benefits.map((b, i) => {
                const Icon = planInfo.icons[i] || Check;
                return (
                  <div key={b} className="flex items-center gap-3">
                    <Icon size={14} className="text-gold" />
                    <span className="text-sm text-foreground">{t(b)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {subscription.status === 'ACTIVE' && !subscription.cancel_at_period_end && (
            <button className="w-full text-center text-xs text-muted-foreground py-3 hover:text-destructive transition-colors">
              {t('club.cancelSubscription')}
            </button>
          )}
        </div>
        <BottomNav />
      </div>
    );
  }

  // Plans selection
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-6 pt-12 pb-4">
        <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={18} />
          <span className="text-sm">{t('general.back')}</span>
        </button>
        <h1 className="font-display text-3xl text-foreground">{t('club.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('club.subtitle')}</p>
      </div>

      <div className="px-6 space-y-4">
        {PLANS.map((plan, idx) => (
          <motion.div
            key={plan.plan}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-gold" />
                  <h3 className="font-display text-xl text-foreground">{t(plan.nameKey)}</h3>
                </div>
                <div>
                  <span className="font-display text-2xl text-gold">{plan.price}€</span>
                  <span className="text-xs text-muted-foreground">{t('club.perMonth')}</span>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {plan.benefits.map((b, i) => {
                  const Icon = plan.icons[i] || Check;
                  return (
                    <div key={b} className="flex items-center gap-2">
                      <Icon size={14} className="text-gold" />
                      <span className="text-sm text-foreground">{t(b)}</span>
                    </div>
                  );
                })}
              </div>

              <Button className="w-full gradient-gold text-primary-foreground shadow-gold hover:opacity-90">
                {t('club.subscribe')}
              </Button>
            </div>
          </motion.div>
        ))}
      </div>

      <BottomNav />
    </div>
  );
};

export default Club;
