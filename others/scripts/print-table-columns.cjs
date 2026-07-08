const { Client } = require('pg');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');

const passwords = [
  "Vijay@2005RV05",
  "vijay@2005r",
  "Vijay@2005050"
];
const ports = [5432, 6543];
const poolerHost = 'aws-1-ap-south-1.pooler.supabase.com';

async function main() {
  let client;
  let connected = false;

  for (let i = 0; i < passwords.length; i++) {
    const password = passwords[i];
    const encodedPassword = encodeURIComponent(password);
    
    for (let j = 0; j < ports.length; j++) {
      const port = ports[j];
      const connectionString = `postgresql://postgres.brvcylvmiwsesdzlxlqa:${encodedPassword}@${poolerHost}:${port}/postgres`;
      client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
      });

      try {
        await client.connect();
        connected = true;
        break;
      } catch (err) {
        await client.end().catch(() => {});
      }
    }
    if (connected) break;
  }

  if (!connected) {
    console.error('❌ Database connection failed.');
    return;
  }

  try {
    console.log('Columns of public.audit_templates:');
    const resColumns = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'audit_templates'
      ORDER BY ordinal_position;
    `);
    console.table(resColumns.rows);

  } catch (err) {
    console.error('❌ Query failed:', err.message);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
