import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Crown, Scissors, Palette, CalendarCheck, Star, Gift, Cake, Tag, Ticket, Settings, Loader2, AlertTriangle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { toast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';

const PremiumBenefits = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();
  const [plan, setPlan] = useState<string | null>(null);
  const [birthday, setBirthday] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: customer } = await supabase
        .from('customers')
        .select('id, date_of_birth')
        .eq('user_id', user.id)
        .single();
      if (!customer) { setLoading(false); return; }

      setBirthday((customer as any).date_of_birth);

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan, current_period_end')
        .eq('customer_id', customer.id)
        .eq('status', 'ACTIVE')
        .maybeSingle();
      if (sub) {
        setPlan(sub.plan);
        setSubscriptionEnd(sub.current_period_end);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleManage = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
    }
    setPortalLoading(false);
  };

  const isBirthdayMonth = () => {
    if (!birthday) return false;
    const now = new Date();
    const bday = new Date(birthday);
    return bday.getMonth() === now.getMonth();
  };

  const isLadies = plan === 'LADIES_59';

  const benefits = isLadies
    ? [
        { icon: Scissors, key: 'premium.cutIncluded' },
        { icon: Palette, key: 'premium.colorDiscount' },
        { icon: CalendarCheck, key: 'premium.priorityAccess' },
        { icon: Star, key: 'premium.monthlyTreatment' },
      ]
    : [
        { icon: Scissors, key: 'premium.cutIncluded' },
        { icon: Tag, key: 'premium.extraCutDiscount' },
        { icon: CalendarCheck, key: 'premium.priorityAccess' },
      ];

  const exclusiveBenefits = [
    { icon: Cake, key: 'premium.birthdayBenefit' },
    { icon: Ticket, key: 'premium.exclusivePromos' },
    { icon: Gift, key: 'premium.exclusiveGiveaways' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-6 pt-12 pb-4"><div className="h-8 w-40 animate-pulse rounded bg-muted" /></div>
        <div className="px-6 space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-6 pt-12 pb-4">
        <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={18} />
          <span className="text-sm">{t('general.back')}</span>
        </button>
        <div className="flex items-center gap-2">
          <Crown className="h-6 w-6 text-gold" />
          <h1 className="font-display text-3xl text-foreground">Premium</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">de<span className="text-gold">nueve</span>a<span className="text-gold">nueve</span></p>
      </div>

      <div className="px-6 space-y-4">
        {/* Birthday alert */}
        {isBirthdayMonth() && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border border-gold/30 bg-gradient-to-r from-gold/15 to-gold/5 p-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/20">
                <Cake className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{t('premium.birthdayAlert')}</p>
                <p className="text-xs text-gold-light">{t('premium.birthdayAlertDesc')}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Plan benefits */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-foreground mb-3">{t('premium.yourBenefits')}</h3>
          <div className="space-y-3">
            {benefits.map(({ icon: Icon, key }) => (
              <div key={key} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10">
                  <Icon size={16} className="text-gold" />
                </div>
                <span className="text-sm text-foreground">{t(key)}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Exclusive benefits */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border border-gold/20 bg-gradient-to-br from-gold/5 to-transparent p-4">
          <h3 className="text-sm font-medium text-foreground mb-3">{t('premium.exclusiveBenefits')}</h3>
          <div className="space-y-3">
            {exclusiveBenefits.map(({ icon: Icon, key }) => (
              <div key={key} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10">
                  <Icon size={16} className="text-gold" />
                </div>
                <span className="text-sm text-foreground">{t(key)}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Manage subscription */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleManage}
          disabled={portalLoading}
        >
          {portalLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Settings className="h-4 w-4 mr-2" />}
          {t('club.manageSubscription')}
        </Button>
      </div>

      <BottomNav />
    </div>
  );
};

export default PremiumBenefits;
