import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase environment variables are not set. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

export const supabaseServer = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});
