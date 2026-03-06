import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const POINTS_PER_VISIT = 10

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Authenticate the calling user (staff)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAuth = createClient(supabaseUrl, serviceRoleKey)

    // Verify staff token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: staffUser }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !staffUser) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check staff has role
    const { data: roleData } = await supabaseAuth
      .from('user_roles')
      .select('role')
      .eq('user_id', staffUser.id)
      .in('role', ['staff', 'manager', 'admin'])
      .limit(1)

    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: 'Unauthorized: staff role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { qr_token, location_id } = await req.json()

    if (!qr_token || !location_id) {
      return new Response(JSON.stringify({ error: 'qr_token and location_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Look up customer by QR token
    const { data: customer, error: custError } = await supabaseAuth
      .from('customers')
      .select('id, first_name, last_name, status')
      .eq('qr_token', qr_token)
      .single()

    if (custError || !customer) {
      return new Response(JSON.stringify({ error: 'Customer not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (customer.status === 'DISABLED') {
      return new Response(JSON.stringify({ error: 'Customer account is disabled' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const now = new Date().toISOString()

    // Update loyalty account: increment visits and points
    const { data: loyaltyBefore } = await supabaseAuth
      .from('loyalty_accounts')
      .select('*')
      .eq('customer_id', customer.id)
      .single()

    const newVisits = (loyaltyBefore?.visits_total || 0) + 1
    const newPoints = (loyaltyBefore?.points_balance || 0) + POINTS_PER_VISIT

    await supabaseAuth
      .from('loyalty_accounts')
      .update({
        visits_total: newVisits,
        points_balance: newPoints,
        last_visit_at: now,
        last_activity_at: now,
      })
      .eq('customer_id', customer.id)

    // Record points movement
    await supabaseAuth
      .from('points_movements')
      .insert({
        customer_id: customer.id,
        type: 'EARN',
        points: POINTS_PER_VISIT,
        reason: 'Visita certificada',
        ref_type: 'visit',
      })

    // Record audit log
    await supabaseAuth
      .from('audit_logs')
      .insert({
        action: 'VERIFY_VISIT',
        actor_id: staffUser.id,
        actor_role: 'STAFF',
        entity: 'loyalty_accounts',
        entity_id: customer.id,
        location_id,
        metadata: { visits_total: newVisits, points_added: POINTS_PER_VISIT },
      })

    // Check milestone rewards (3, 5, 8, 10 visits)
    const milestoneMap: Record<number, string> = {
      3: 'SCALP_DIAGNOSIS',
      5: 'EXPRESS_TREATMENT',
      8: 'RETAIL_VOUCHER',
      10: 'PACK_UPGRADE',
    }

    let unlockedReward: string | null = null

    if (milestoneMap[newVisits]) {
      const rewardType = milestoneMap[newVisits]
      const code = `RW-${rewardType.substring(0, 3)}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

      await supabaseAuth.from('rewards').insert({
        customer_id: customer.id,
        type: rewardType,
        code,
        expires_at: expiresAt,
        status: 'AVAILABLE',
      })

      unlockedReward = rewardType
    }

    return new Response(JSON.stringify({
      success: true,
      customer: { name: `${customer.first_name} ${customer.last_name}` },
      visits_total: newVisits,
      points_balance: newPoints,
      points_added: POINTS_PER_VISIT,
      unlocked_reward: unlockedReward,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
