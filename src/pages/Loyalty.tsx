import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Gift, ArrowUpRight, ArrowDownRight, Clock, Award, Ticket, QrCode } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import type { Tables } from '@/integrations/supabase/types';

type LoyaltyAccount = Tables<'loyalty_accounts'>;
type PointsMovement = Tables<'points_movements'>;
type Reward = Tables<'rewards'>;
type WelcomeCoupon = Tables<'welcome_coupons'>;

const MILESTONES = [
  { visits: 3, key: '3', icon: Award },
  { visits: 5, key: '5', icon: Gift },
  { visits: 8, key: '8', icon: Ticket },
  { visits: 10, key: '10', icon: Star },
];

const MOVEMENT_ICONS: Record<string, typeof ArrowUpRight> = {
  EARN: ArrowUpRight,
  REDEEM: ArrowDownRight,
  ADJUST: Clock,
  EXPIRE: Clock,
};

const Loyalty = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();

  const [tab, setTab] = useState<'overview' | 'movements' | 'rewards'>('overview');
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [movements, setMovements] = useState<PointsMovement[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [coupon, setCoupon] = useState<WelcomeCoupon | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCode, setShowCode] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!customer) { setLoading(false); return; }

      const [loyaltyRes, movementsRes, rewardsRes, couponRes] = await Promise.all([
        supabase.from('loyalty_accounts').select('*').eq('customer_id', customer.id).single(),
        supabase.from('points_movements').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('rewards').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }),
        supabase.from('welcome_coupons').select('*').eq('customer_id', customer.id).single(),
      ]);

      setAccount(loyaltyRes.data);
      setMovements(movementsRes.data || []);
      setRewards(rewardsRes.data || []);
      setCoupon(couponRes.data);
      setLoading(false);
    };
    load();
  }, [user]);

  const REWARD_STATUS_COLOR: Record<string, string> = {
    AVAILABLE: 'text-success',
    REDEEMED: 'text-muted-foreground',
    EXPIRED: 'text-destructive',
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-6 pt-12 pb-4">
        <h1 className="font-display text-3xl text-foreground">{t('loyalty.title')}</h1>
      </div>

      {loading ? (
        <div className="px-6 space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="flex gap-3 px-6 mb-4">
            <div className="flex-1 rounded-xl border border-border bg-card p-4 text-center">
              <p className="font-display text-3xl text-gold">{account?.points_balance || 0}</p>
              <p className="text-xs text-muted-foreground">{t('loyalty.points')}</p>
            </div>
            <div className="flex-1 rounded-xl border border-border bg-card p-4 text-center">
              <p className="font-display text-3xl text-foreground">{account?.visits_total || 0}</p>
              <p className="text-xs text-muted-foreground">{t('loyalty.visits')}</p>
            </div>
          </div>

          {/* Milestones Progress */}
          <div className="px-6 mb-4">
            <h3 className="text-sm font-medium text-foreground mb-3">{t('loyalty.milestones')}</h3>
            <div className="flex items-center justify-between">
              {MILESTONES.map((m, i) => {
                const Icon = m.icon;
                const reached = (account?.visits_total || 0) >= m.visits;
                return (
                  <div key={m.key} className="flex flex-col items-center gap-1">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                      reached ? 'border-gold bg-gold/20' : 'border-border bg-card'
                    }`}>
                      <Icon size={18} className={reached ? 'text-gold' : 'text-muted-foreground'} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{m.visits}v</span>
                    <span className="text-[9px] text-muted-foreground text-center leading-tight max-w-[60px]">
                      {t(`loyalty.milestone.${m.key}`)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mx-6 mb-4 rounded-lg bg-muted p-1">
            {(['overview', 'movements', 'rewards'] as const).map((t2) => (
              <button
                key={t2}
                onClick={() => setTab(t2)}
                className={`flex-1 rounded-md py-2 text-xs font-medium transition-all ${
                  tab === t2 ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {t2 === 'overview' ? t('loyalty.coupon') : t(`loyalty.${t2}`)}
              </button>
            ))}
          </div>

          <div className="px-6">
            {tab === 'overview' && (
              <div className="space-y-3">
                {coupon ? (
                  <div className={`rounded-xl border p-4 ${
                    coupon.status === 'ACTIVE'
                      ? 'border-gold/20 bg-gold/5'
                      : 'border-border bg-card'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Gift className={`h-5 w-5 ${coupon.status === 'ACTIVE' ? 'text-gold' : 'text-muted-foreground'}`} />
                        <span className="text-sm font-medium text-foreground">{coupon.percent_off}% {t('loyalty.coupon')}</span>
                      </div>
                      <span className={`text-xs font-medium ${
                        coupon.status === 'ACTIVE' ? 'text-gold' : 'text-muted-foreground'
                      }`}>
                        {t(`loyalty.coupon${coupon.status === 'ACTIVE' ? 'Active' : coupon.status === 'USED' ? 'Used' : 'Expired'}`)}
                      </span>
                    </div>
                    {coupon.status === 'ACTIVE' && (
                      <p className="text-xs text-muted-foreground">
                        {t('loyalty.expiresAt')} {new Date(coupon.expires_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">{t('loyalty.noCoupon')}</p>
                )}

                {account?.last_visit_at && (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground">{t('loyalty.lastVisit')}</p>
                    <p className="text-sm text-foreground">{new Date(account.last_visit_at).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            )}

            {tab === 'movements' && (
              <div className="space-y-2">
                {movements.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">{t('loyalty.noMovements')}</p>
                ) : (
                  movements.map((m, i) => {
                    const Icon = MOVEMENT_ICONS[m.type] || Clock;
                    const isPositive = m.points > 0;
                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                      >
                        <Icon size={16} className={isPositive ? 'text-gold' : 'text-muted-foreground'} />
                        <div className="flex-1">
                          <p className="text-xs text-foreground">{m.reason}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(m.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`text-sm font-medium ${isPositive ? 'text-gold' : 'text-muted-foreground'}`}>
                          {isPositive ? '+' : ''}{m.points}
                        </span>
                      </motion.div>
                    );
                  })
                )}
              </div>
            )}

            {tab === 'rewards' && (
              <div className="space-y-3">
                {rewards.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">{t('loyalty.noRewards')}</p>
                ) : (
                  rewards.map((r) => (
                    <div key={r.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground">
                          {t(`loyalty.milestone.${
                            r.type === 'SCALP_DIAGNOSIS' ? '3' :
                            r.type === 'EXPRESS_TREATMENT' ? '5' :
                            r.type === 'RETAIL_VOUCHER' ? '8' :
                            r.type === 'PACK_UPGRADE' ? '10' : '3'
                          }`)}
                        </span>
                        <span className={`text-xs font-medium ${REWARD_STATUS_COLOR[r.status]}`}>
                          {t(`loyalty.reward${r.status === 'AVAILABLE' ? 'Available' : r.status === 'REDEEMED' ? 'Redeemed' : 'Expired'}`)}
                        </span>
                      </div>
                      {r.status === 'AVAILABLE' && (
                        <>
                          <p className="text-xs text-muted-foreground mb-2">
                            {t('loyalty.expiresAt')} {new Date(r.expires_at).toLocaleDateString()}
                          </p>
                          <button
                            onClick={() => setShowCode(showCode === r.id ? null : r.id)}
                            className="flex items-center gap-1.5 text-xs text-gold"
                          >
                            <QrCode size={14} /> {t('loyalty.showCode')}
                          </button>
                          {showCode === r.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-3 rounded-lg bg-muted p-3 text-center"
                            >
                              <p className="font-mono text-lg tracking-widest text-foreground">{r.code}</p>
                            </motion.div>
                          )}
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}

      <BottomNav />
    </div>
  );
};

export default Loyalty;
