const { Client } = require('pg');
const dns = require('dns');
const bcrypt = require('bcryptjs');

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
    console.log('Resetting and unlocking all employees in active DB using bcryptjs...');
    const users = [
      { code: 'ARC100', pass: 'ARCOLAB100' },
      { code: 'ARC101', pass: 'ARCOLAB101' },
      { code: 'ARC102', pass: 'ARCOLAB102' }
    ];

    for (const u of users) {
      const res = await client.query(`
        UPDATE public.profiles
        SET failed_attempts = 0,
            locked_until = NULL
        WHERE employee_code = $1
        RETURNING id, email;
      `, [u.code]);

      if (res.rows.length > 0) {
        const { id, email } = res.rows[0];
        console.log(`Unlocking profile: ${u.code} (${email})`);

        // Generate bcrypt hash using bcryptjs
        const hash = bcrypt.hashSync(u.pass, 10);

        await client.query(`
          UPDATE auth.users 
          SET encrypted_password = $1,
              updated_at = now()
          WHERE id = $2;
        `, [hash, id]);
        console.log(`  -> Successfully updated encrypted_password for ${u.code} with hash: ${hash}`);
      } else {
        console.log(`❌ Profile ${u.code} not found.`);
      }
    }

    console.log('✅ BCRYPTJS RESET AND UNLOCK COMPLETED!');
  } catch (err) {
    console.error('❌ Database operation failed:', err.message);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
