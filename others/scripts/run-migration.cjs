const { Client } = require('pg');

async function run() {
  const password = "Vijay@2005050";
  // Encode the @ symbol in the password since it is a reserved URL character
  const encodedPassword = encodeURIComponent(password);
  
  const connectionString = `postgresql://postgres:${encodedPassword}@db.hbfwlvxeywibqmsywqgm.supabase.co:5432/postgres`;
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting directly to Supabase PostgreSQL database...');
    await client.connect();
    console.log('Connected! Applying the column upgrades...');

    await client.query(`
      ALTER TABLE public.analysis_logs
        ADD COLUMN IF NOT EXISTS office_name          TEXT,
        ADD COLUMN IF NOT EXISTS before_latitude      DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS before_longitude     DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS before_captured_at   TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS after_latitude       DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS after_longitude      DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS after_captured_at    TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS captured_at          TIMESTAMP WITH TIME ZONE;
    `);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_analysis_logs_office_name ON public.analysis_logs (office_name);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_analysis_logs_before_captured_at ON public.analysis_logs (before_captured_at);`);
    
    console.log('✅ ALL GEOTAG COLUMNS HAVE BEEN SUCCESSFULLY ADDED!');
  } catch (err) {
    console.error('❌ Connection or query failed:', err.message);
  } finally {
    await client.end();
  }
}

run();
