const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env and fill in SUPABASE_SERVICE_ROLE_KEY (Dashboard > Project Settings > API).'
  );
}

// Used for auth calls (signup/login) — respects RLS.
const supabaseAnon = createClient(supabaseUrl, anonKey);

// Used for all server-side data access and admin operations — bypasses RLS.
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

module.exports = { supabaseAnon, supabaseAdmin };
