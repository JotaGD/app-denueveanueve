import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const enc = (obj: any) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const unsignedToken = `${enc(header)}.${enc(claim)}`

  // Import the private key
  const pemBody = serviceAccount.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '')
  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0))
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  )

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const jwt = `${unsignedToken}.${sig}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`)
  }
  return tokenData.access_token
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')

    if (!saJson) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured')
    }

    // Verify staff/admin auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', user.id)
      .in('role', ['manager', 'admin']).limit(1)

    if (!roleData?.length) {
      return new Response(JSON.stringify({ error: 'Admin/Manager role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const serviceAccount = JSON.parse(saJson)
    const accessToken = await getAccessToken(serviceAccount)

    // List all calendars accessible by the service account
    const calRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const calData = await calRes.json()
    const calendars = calData.items || []

    // Get staff members with locations
    const { data: staffMembers } = await supabase
      .from('staff_members')
      .select('id, name, location_id, locations(name)')

    // Map prefix to location
    const locationPrefixMap: Record<string, string> = {}
    const { data: locations } = await supabase.from('locations').select('id, name')
    if (locations) {
      for (const loc of locations) {
        if (loc.name.includes('Alpedrete')) locationPrefixMap['A'] = loc.id
        if (loc.name.includes('Collado') || loc.name.includes('Villalba')) locationPrefixMap['CV'] = loc.id
      }
    }

    const mappings: { staff_member_id: string; google_calendar_id: string; calendar_name: string }[] = []

    for (const cal of calendars) {
      const summary: string = cal.summary || ''
      // Match pattern "A - Name" or "CV - Name"
      const match = summary.match(/^(A|CV)\s*-\s*(.+)$/i)
      if (!match) continue

      const prefix = match[1].toUpperCase()
      const calName = match[2].trim()
      const locId = locationPrefixMap[prefix]
      if (!locId) continue

      // Find matching staff member
      const staff = staffMembers?.find(
        (s: any) => s.name.toLowerCase() === calName.toLowerCase() && s.location_id === locId
      )

      if (staff) {
        mappings.push({
          staff_member_id: staff.id,
          google_calendar_id: cal.id,
          calendar_name: summary,
        })
      }
    }

    // Upsert mappings
    if (mappings.length > 0) {
      const { error: upsertErr } = await supabase
        .from('staff_calendar_mappings')
        .upsert(
          mappings.map((m) => ({
            staff_member_id: m.staff_member_id,
            google_calendar_id: m.google_calendar_id,
          })),
          { onConflict: 'staff_member_id' }
        )

      if (upsertErr) {
        throw new Error(`Failed to upsert mappings: ${upsertErr.message}`)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      calendars_found: calendars.length,
      mappings_created: mappings.length,
      details: mappings.map((m) => ({
        calendar: m.calendar_name,
        staff_id: m.staff_member_id,
        google_calendar_id: m.google_calendar_id,
      })),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('sync-google-calendars error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
