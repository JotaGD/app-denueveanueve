import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Crown, Check, Star, Scissors, Palette, CalendarCheck, Info, BadgeEuro, Loader2, Settings } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { toast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';
import CheckoutForm from '@/components/CheckoutForm';

const stripePromise = loadStripe('pk_test_51T8nG9IsEUPwjqgmIaucyy7g3w3Z0rPgZC9PEvJUgI5RMDjGsn1DeXppc9aclkJcrVkG9p0lG9F5nsSdKpKMMWMr00K6OMdVI0');

const PLANS = [
  {
    plan: 'LADIES_59' as const,
    nameKey: 'club.ladies',
    price: 59,
    benefits: ['club.ladiesBenefits.1', 'club.ladiesBenefits.2', 'club.ladiesBenefits.3', 'club.ladiesBenefits.4'],
    icons: [Scissors, Palette, CalendarCheck, Star],
    detailKey: 'club.ladiesDetail',
  },
  {
    plan: 'MEN_19' as const,
    nameKey: 'club.men',
    price: 19,
    benefits: ['club.menBenefits.1', 'club.menBenefits.2', 'club.menBenefits.3', 'club.menBenefits.4'],
    icons: [Scissors, BadgeEuro, CalendarCheck, Star],
    detailKey: 'club.menDetail',
  },
];

interface StripeSubscription {
  subscribed: boolean;
  plan?: string | null;
  subscription_end?: string | null;
  cancel_at_period_end?: boolean;
}

const Club = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const { user } = useAuth();

  const [stripeSub, setStripeSub] = useState<StripeSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [infoPlan, setInfoPlan] = useState<typeof PLANS[number] | null>(null);

  // Embedded payment state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentPlan, setPaymentPlan] = useState<typeof PLANS[number] | null>(null);

  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout === 'success') {
      toast({ title: t('club.checkoutSuccess'), description: t('club.checkoutSuccessDesc') });
    }
  }, [searchParams, t]);

  useEffect(() => {
    if (!user) return;
    const checkSub = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('check-subscription');
        if (error) throw error;
        setStripeSub(data as StripeSubscription);
      } catch {
        setStripeSub({ subscribed: false });
      }
      setLoading(false);
    };
    checkSub();
  }, [user]);

  const handleSubscribe = async (plan: typeof PLANS[number]) => {
    setCheckoutLoading(plan.plan);
    try {
      const { data, error } = await supabase.functions.invoke('create-subscription-intent', {
        body: { plan: plan.plan },
      });
      if (error) throw error;
      if (data?.clientSecret) {
        setClientSecret(data.clientSecret);
        setPaymentPlan(plan);
      }
    } catch (err) {
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
    }
    setCheckoutLoading(null);
  };

  const handlePaymentSuccess = () => {
    setClientSecret(null);
    setPaymentPlan(null);
    toast({ title: t('club.checkoutSuccess'), description: t('club.checkoutSuccessDesc') });
    // Refresh subscription status
    setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke('check-subscription');
        if (data) setStripeSub(data as StripeSubscription);
      } catch {}
    }, 2000);
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
    }
    setPortalLoading(false);
  };

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
  if (stripeSub?.subscribed && stripeSub.plan) {
    const planInfo = PLANS.find((p) => p.plan === stripeSub.plan);
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
          <div className="rounded-xl border border-gold/20 bg-gradient-to-br from-gold/10 to-gold/5 p-5">
            <div className="flex items-center gap-3 mb-3">
              <Crown className="h-6 w-6 text-gold" />
              <div>
                <p className="text-lg font-display text-foreground">{planInfo ? t(planInfo.nameKey) : stripeSub.plan}</p>
                <span className="text-xs text-gold">
                  {stripeSub.cancel_at_period_end ? t('club.cancelledEnd') : t('club.active')}
                </span>
              </div>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              {stripeSub.subscription_end && (
                <p>{stripeSub.cancel_at_period_end ? t('club.endsAt') : t('club.nextRenewal')}: {new Date(stripeSub.subscription_end).toLocaleDateString()}</p>
              )}
            </div>
          </div>

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

          <Button
            variant="outline"
            className="w-full"
            onClick={handleManageSubscription}
            disabled={portalLoading}
          >
            {portalLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Settings className="h-4 w-4 mr-2" />}
            {t('club.manageSubscription')}
          </Button>
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

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setInfoPlan(plan)}
                >
                  <Info size={18} />
                </Button>
                <Button
                  className="w-full gradient-gold text-primary-foreground shadow-gold hover:opacity-90"
                  onClick={() => handleSubscribe(plan)}
                  disabled={checkoutLoading !== null}
                >
                  {checkoutLoading === plan.plan ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {t('club.subscribe')}
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Info Dialog */}
      <Dialog open={!!infoPlan} onOpenChange={(open) => !open && setInfoPlan(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-gold" />
              {infoPlan && t(infoPlan.nameKey)} — {infoPlan?.price}€{t('club.perMonth')}
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-foreground whitespace-pre-line leading-relaxed">
            {infoPlan && t(infoPlan.detailKey)}
          </div>
        </DialogContent>
      </Dialog>

      {/* Embedded Payment Dialog */}
      <Dialog open={!!clientSecret} onOpenChange={(open) => { if (!open) { setClientSecret(null); setPaymentPlan(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-gold" />
              {paymentPlan && t(paymentPlan.nameKey)} — {paymentPlan?.price}€{t('club.perMonth')}
            </DialogTitle>
          </DialogHeader>
          {clientSecret && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'night',
                  variables: {
                    colorPrimary: '#c8973e',
                    colorBackground: '#1a1714',
                    colorText: '#e8dcc8',
                    colorDanger: '#ef4444',
                    fontFamily: '"Josefin Sans", sans-serif',
                    borderRadius: '0.75rem',
                  },
                },
              }}
            >
              <CheckoutForm
                onSuccess={handlePaymentSuccess}
                onError={(msg) => toast({ title: 'Error', description: msg, variant: 'destructive' })}
              />
            </Elements>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default Club;
