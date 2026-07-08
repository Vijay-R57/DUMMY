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
    console.log('Checking for supabase_migrations schema and table...');
    const resSchema = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'supabase_migrations' 
        AND table_name = 'schema_migrations'
      );
    `);
    
    const exists = resSchema.rows[0].exists;
    console.log('supabase_migrations.schema_migrations exists:', exists);

    if (exists) {
      const resMigrations = await client.query('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;');
      console.log('Applied migrations inside supabase_migrations:');
      console.table(resMigrations.rows);
    }

    console.log('Checking all tables in public schema:');
    const resTables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.table(resTables.rows);

  } catch (err) {
    console.error('❌ Query failed:', err.message);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
