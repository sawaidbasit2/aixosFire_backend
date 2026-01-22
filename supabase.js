require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // use service role key

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key is missing from .env file');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;  
