const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dns = require('dns');
const bcrypt = require('bcryptjs');

// Prioritize IPv4 resolution to prevent IPv6 connection timeouts on networks without IPv6 routing
dns.setDefaultResultOrder('ipv4first');

const passwords = [
  "Vijay@2005RV05",
  "vijay@2005r",
  "Vijay@2005050"
];
const ports = [5432, 6543];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  let client;
  let connected = false;
  const poolerHost = 'aws-1-ap-south-1.pooler.supabase.com';

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
        console.log(`Connecting to Pooler (${poolerHost}:${port}) with password: ${password.substring(0, 3)}...`);
        await client.connect();
        connected = true;
        console.log('Connected successfully!');
        break;
      } catch (err) {
        console.log(`Failed on port ${port} with password starting with ${password.substring(0, 3)}: ${err.message}`);
        await client.end().catch(() => {});
        if (i < passwords.length - 1 || j < ports.length - 1) {
          console.log('Waiting 45 seconds to let the connection pooler cool down...');
          await sleep(45000);
        }
      }
    }
    if (connected) break;
  }

  if (!connected) {
    console.error('❌ Database connection failed for all password attempts.');
    return;
  }

  try {
    console.log('Fetching migration files...');

    const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Alphabetic sort matches chronological order

    console.log(`Found ${files.length} migration files to apply.`);

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      console.log(`Applying migration: ${file}...`);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Execute the SQL file
      await client.query(sql);
      console.log(`✅ Successfully applied: ${file}`);
    }

    console.log('Database migrations applied successfully. Seeding offices...');

    // Seed Offices
    const offices = [
      { name: 'Softgel Healthcare Private Limited', city: 'Chennai', country: 'India' },
      { name: 'Solara Active Pharma Sciences Limited', city: 'Chennai', country: 'India' },
      { name: 'Strides Pharma', city: 'Chennai', country: 'India' }
    ];

    for (const office of offices) {
      const checkRes = await client.query(
        'SELECT id FROM public.offices WHERE name = $1 AND city = $2',
        [office.name, office.city]
      );

      if (checkRes.rows.length === 0) {
        console.log(`Inserting office: ${office.name}...`);
        await client.query(
          'INSERT INTO public.offices (name, city, country) VALUES ($1, $2, $3)',
          [office.name, office.city, office.country]
        );
      } else {
        console.log(`Office already exists: ${office.name}`);
      }
    }
    console.log('✅ Offices seeded.');

    // Seed Users
    const users = [
      {
        email: 'arc100@arcolab.com',
        password: 'ARCOLAB100',
        metadata: {
          first_name: 'Shankar',
          last_name: 'R',
          role: 'worker',
          employee_code: 'ARC100'
        }
      },
      {
        email: 'arc101@arcolab.com',
        password: 'ARCOLAB101',
        metadata: {
          first_name: 'Naveen',
          last_name: 'SV',
          role: 'supervisor',
          employee_code: 'ARC101'
        }
      },
      {
        email: 'arc102@arcolab.com',
        password: 'ARCOLAB102',
        metadata: {
          first_name: 'Guest',
          last_name: 'User',
          role: 'worker',
          employee_code: 'ARC102'
        }
      }
    ];

    // Ensure pgcrypto extension is active for crypt/gen_salt
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

    for (const u of users) {
      console.log(`Checking user: ${u.email}...`);
      const userCheck = await client.query('SELECT id FROM auth.users WHERE email = $1', [u.email]);
      
      const passwordHash = bcrypt.hashSync(u.password, 10);
      let userId;
      if (userCheck.rows.length === 0) {
        console.log(`Inserting auth user: ${u.email}...`);
        const insertQuery = `
          INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            is_super_admin,
            recovery_token,
            email_change_token_new,
            email_change,
            phone_change,
            phone_change_token,
            email_change_token_current,
            reauthentication_token
          ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            $1,
            $2,
            now(),
            '{"provider": "email", "providers": ["email"]}'::jsonb,
            $3::jsonb,
            now(),
            now(),
            false,
            '',
            '',
            '',
            '',
            '',
            '',
            ''
          ) RETURNING id;
        `;
        const insertRes = await client.query(insertQuery, [u.email, passwordHash, JSON.stringify(u.metadata)]);
        userId = insertRes.rows[0].id;
        console.log(`User ${u.email} seeded with ID: ${userId}`);
      } else {
        userId = userCheck.rows[0].id;
        console.log(`User ${u.email} already exists with ID: ${userId}. Resetting password and profiles...`);
        await client.query(`
          UPDATE auth.users 
          SET raw_user_meta_data = $1::jsonb,
              encrypted_password = $2,
              updated_at = now()
          WHERE id = $3
        `, [JSON.stringify(u.metadata), passwordHash, userId]);
      }

      // Sync public.profiles manual backfill
      await client.query(`
        INSERT INTO public.profiles (id, email, first_name, last_name, role, employee_code)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          email = excluded.email,
          first_name = excluded.first_name,
          last_name = excluded.last_name,
          role = excluded.role,
          employee_code = excluded.employee_code;
      `, [
        userId, 
        u.email, 
        u.metadata.first_name, 
        u.metadata.last_name, 
        u.metadata.role, 
        u.metadata.employee_code
      ]);

      // Sync auth.identities
      const identityData = {
        sub: userId,
        email: u.email,
        role: u.metadata.role,
        first_name: u.metadata.first_name,
        last_name: u.metadata.last_name,
        employee_code: u.metadata.employee_code,
        email_verified: true,
        phone_verified: false
      };

      const identityCheck = await client.query('SELECT id FROM auth.identities WHERE user_id = $1', [userId]);
      if (identityCheck.rows.length === 0) {
        await client.query(`
          INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
          ) VALUES (
            gen_random_uuid(),
            $1,
            $2::jsonb,
            'email',
            $3,
            now(),
            now(),
            now()
          )
        `, [userId, JSON.stringify(identityData), u.email]);
      } else {
        await client.query(`
          UPDATE auth.identities
          SET identity_data = $1::jsonb,
              updated_at = now()
          WHERE user_id = $2
        `, [JSON.stringify(identityData), userId]);
      }
    }

    console.log('✅ DATABASE INITIALIZATION AND SEEDING COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Database migration or seeding failed:', err.stack || err.message);
  } finally {
    await client.end();
  }
}

main();
