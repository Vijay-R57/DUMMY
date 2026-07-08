const { Client } = require('pg');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

async function main() {
  const password = "Vijay@2005RV05";
  const encodedPassword = encodeURIComponent(password);
  const poolerHost = 'aws-1-ap-south-1.pooler.supabase.com';
  const connectionString = `postgresql://postgres.brvcylvmiwsesdzlxlqa:${encodedPassword}@${poolerHost}:5432/postgres`;

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected! Reloading PostgREST schema cache...');
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log('✅ PostgREST schema cache reload notification sent successfully!');
  } catch (err) {
    console.error('❌ Failed to reload PostgREST schema cache:', err.message);
  } finally {
    await client.end();
  }
}

main();
