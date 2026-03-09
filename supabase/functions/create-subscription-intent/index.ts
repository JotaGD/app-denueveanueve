import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@18.5.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user?.email) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { plan, price_cents } = await req.json()
    if (!plan || !price_cents) {
      return new Response(JSON.stringify({ error: 'plan and price_cents required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' })

    // Find or create Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 })
    let customerId: string
    if (customers.data.length > 0) {
      customerId = customers.data[0].id
    } else {
      const newCustomer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      })
      customerId = newCustomer.id
    }

    // Create a price for the subscription
    const price = await stripe.prices.create({
      currency: 'eur',
      unit_amount: price_cents,
      recurring: { interval: 'month' },
      product_data: {
        name: plan === 'LADIES_39' ? 'Plan Ladies' : 'Plan Men',
      },
    })

    // Create subscription with incomplete payment
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price.id }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      metadata: { plan, user_id: user.id },
      expand: ['latest_invoice.payment_intent'],
    })

    // Get client secret from expanded invoice
    const invoice = subscription.latest_invoice as any
    const paymentIntent = invoice?.payment_intent
    let clientSecret: string | null = paymentIntent?.client_secret || null

    if (!clientSecret) {
      console.error('No client_secret from subscription', { 
        invoiceId: invoice?.id,
        piId: paymentIntent?.id,
      })
      throw new Error('Could not obtain payment client secret')
    }

    // Get customer record from our DB
    const { data: customer } = await supabaseClient
      .from('customers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (customer) {
      // Upsert subscription in our DB
      await supabaseClient
        .from('subscriptions')
        .upsert({
          customer_id: customer.id,
          plan: plan,
          price_cents: price_cents,
          currency: 'EUR',
          status: 'PAYMENT_DUE',
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          current_period_start: subscription.current_period_start ? new Date(typeof subscription.current_period_start === 'number' ? subscription.current_period_start * 1000 : subscription.current_period_start).toISOString() : null,
          current_period_end: subscription.current_period_end ? new Date(typeof subscription.current_period_end === 'number' ? subscription.current_period_end * 1000 : subscription.current_period_end).toISOString() : null,
          next_renewal_at: subscription.current_period_end ? new Date(typeof subscription.current_period_end === 'number' ? subscription.current_period_end * 1000 : subscription.current_period_end).toISOString() : null,
        }, {
          onConflict: 'customer_id',
          ignoreDuplicates: false,
        })
    }

    return new Response(JSON.stringify({
      subscriptionId: subscription.id,
      clientSecret: paymentIntent.client_secret,
      customerId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('create-subscription-intent error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
