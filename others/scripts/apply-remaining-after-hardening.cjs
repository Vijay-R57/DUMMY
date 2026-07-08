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
    const files = [
      '20260701000000_phase2a1_custom_rules.sql',
      '20260701000001_phase2a1_reliability_level.sql',
      '20260702000000_phase2a3_version_metadata.sql',
      '20260702000001_phase2a3_analytics.sql'
    ];

    for (const file of files) {
      console.log(`Reading ${file}...`);
      const migrationFile = path.join(__dirname, 'supabase', 'migrations', file);
      const sql = fs.readFileSync(migrationFile, 'utf8');

      console.log(`Executing ${file}...`);
      await client.query(sql);
      console.log(`✅ ${file} applied successfully!`);
    }

    console.log('✅ ALL REMAINING MIGRATIONS APPLIED SUCCESSFULLY!');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
