const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
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
    console.log('Reading 20260629100000_phase2a_hardening.sql...');
    const migrationFile = path.join(__dirname, 'supabase', 'migrations', '20260629100000_phase2a_hardening.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log('Executing hardening migration...');
    await client.query(sql);
    console.log('✅ Hardening migration applied successfully!');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (err.position) {
      console.error(`Error position: ${err.position}`);
    }
  } finally {
    await client.end().catch(() => {});
  }
}

main();
