import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { CalendarPlus, Star, Crown, Tag, ChevronRight, Gift } from 'lucide-react';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import logoImg from '@/assets/logo.png';

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4 },
  }),
};

const Home = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();
  const [points, setPoints] = useState(0);
  const [visits, setVisits] = useState(0);

  const firstName = user?.user_metadata?.first_name || 'Cliente';

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (!customer) return;
      const { data: account } = await supabase
        .from('loyalty_accounts')
        .select('points_balance, visits_total')
        .eq('customer_id', customer.id)
        .single();
      if (account) {
        setPoints(account.points_balance);
        setVisits(account.visits_total);
      }
    };
    load();
  }, [user]);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="relative overflow-hidden px-6 pt-12 pb-8">
        <div className="absolute inset-0 bg-gradient-to-b from-gold/5 to-transparent" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{t('home.greeting')},</p>
            <h1 className="font-display text-3xl text-foreground">{firstName}</h1>
          </div>
          <img src={logoImg} alt="denueveanueve" className="h-5 w-auto opacity-70" />
        </div>
      </div>

      <div className="space-y-4 px-6">
        {/* Welcome Coupon */}
        <motion.div
          custom={0}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="relative overflow-hidden rounded-xl border border-gold/20 bg-gradient-to-r from-gold/10 to-gold/5 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/20">
              <Gift className="h-5 w-5 text-gold" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{t('home.welcomeCoupon')}</p>
              <p className="text-xs text-gold-light">{t('home.couponDesc')}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-gold/50" />
          </div>
        </motion.div>

        {/* Next Appointment */}
        <motion.div
          custom={1}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-foreground">{t('home.nextAppointment')}</h3>
            <CalendarPlus className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground mb-3">{t('home.noAppointments')}</p>
          <Button
            onClick={() => navigate('/book')}
            size="sm"
            className="gradient-gold text-primary-foreground shadow-gold hover:opacity-90"
          >
            {t('home.bookNow')}
          </Button>
        </motion.div>

        {/* Loyalty */}
        <motion.div
          custom={2}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          onClick={() => navigate('/loyalty')}
          className="cursor-pointer rounded-xl border border-border bg-card p-4 transition-colors hover:border-gold/20"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-foreground">{t('home.loyalty')}</h3>
            <Star className="h-4 w-4 text-gold" />
          </div>
          <div className="flex gap-6">
            <div>
            <p className="font-display text-2xl text-gold">{points}</p>
              <p className="text-xs text-muted-foreground">{t('home.points')}</p>
            </div>
            <div>
              <p className="font-display text-2xl text-foreground">{visits}</p>
              <p className="text-xs text-muted-foreground">{t('home.visits')}</p>
            </div>
          </div>
        </motion.div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-3">
          <motion.div
            custom={3}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            onClick={() => navigate('/services')}
            className="cursor-pointer rounded-xl border border-border bg-card p-4 transition-colors hover:border-gold/20"
          >
            <Scissors className="mb-2 h-5 w-5 text-gold" />
            <p className="text-sm font-medium text-foreground">{t('home.services')}</p>
          </motion.div>

          <motion.div
            custom={4}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            onClick={() => navigate('/club')}
            className="cursor-pointer rounded-xl border border-border bg-card p-4 transition-colors hover:border-gold/20"
          >
            <Crown className="mb-2 h-5 w-5 text-gold" />
            <p className="text-sm font-medium text-foreground">{t('home.club')}</p>
          </motion.div>

          <motion.div
            custom={5}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            onClick={() => navigate('/promos')}
            className="cursor-pointer rounded-xl border border-border bg-card p-4 transition-colors hover:border-gold/20"
          >
            <Tag className="mb-2 h-5 w-5 text-gold" />
            <p className="text-sm font-medium text-foreground">{t('home.promos')}</p>
          </motion.div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Home;
