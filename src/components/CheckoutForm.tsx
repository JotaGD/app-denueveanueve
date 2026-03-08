import { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface CheckoutFormProps {
  onSuccess: () => void;
  onError: (msg: string) => void;
}

const CheckoutForm = ({ onSuccess, onError }: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + '/club?checkout=success',
      },
      redirect: 'if_required',
    });

    if (error) {
      onError(error.message || 'Payment failed');
    } else {
      onSuccess();
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />
      <Button
        type="submit"
        disabled={!stripe || loading}
        className="w-full gradient-gold text-primary-foreground shadow-gold hover:opacity-90"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {t('club.confirmPayment')}
      </Button>
    </form>
  );
};

export default CheckoutForm;
