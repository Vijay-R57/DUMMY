const fs = require('fs');
const path = require('path');

async function main() {
  const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let combinedSql = '';

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    combinedSql += `-- =============================================================================\n`;
    combinedSql += `-- MIGRATION: ${file}\n`;
    combinedSql += `-- =============================================================================\n\n`;
    combinedSql += sql;
    combinedSql += `\n\n`;
  }

  // Append seed offices
  combinedSql += `-- =============================================================================\n`;
  combinedSql += `-- SEED DATA: Offices\n`;
  combinedSql += `-- =============================================================================\n\n`;
  combinedSql += `INSERT INTO public.offices (name, city, country) VALUES 
('Softgel Healthcare Private Limited', 'Chennai', 'India'),
('Solara Active Pharma Sciences Limited', 'Chennai', 'India'),
('Strides Pharma', 'Chennai', 'India')
ON CONFLICT (name, city) DO NOTHING;

`;

  // Append seed auth users
  combinedSql += `-- =============================================================================\n`;
  combinedSql += `-- SEED DATA: Auth Users & Identities\n`;
  combinedSql += `-- =============================================================================\n\n`;
  combinedSql += `CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- User 1: ARC100 (Worker)
DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'arc100@arcolab.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      'arc100@arcolab.com',
      crypt('ARCOLAB100', gen_salt('bf', 10)),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"first_name": "Shankar", "last_name": "R", "role": "worker", "employee_code": "ARC100"}'::jsonb,
      now(), now(), false
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      new_user_id,
      ('{"sub": "' || new_user_id || '", "email": "arc100@arcolab.com", "role": "worker", "first_name": "Shankar", "last_name": "R", "employee_code": "ARC100", "email_verified": true, "phone_verified": false}')::jsonb,
      'email',
      'arc100@arcolab.com',
      now(), now(), now()
    );
  END IF;
END $$;

-- User 2: ARC101 (Supervisor)
DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'arc101@arcolab.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      'arc101@arcolab.com',
      crypt('ARCOLAB101', gen_salt('bf', 10)),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"first_name": "Naveen", "last_name": "SV", "role": "supervisor", "employee_code": "ARC101"}'::jsonb,
      now(), now(), false
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      new_user_id,
      ('{"sub": "' || new_user_id || '", "email": "arc101@arcolab.com", "role": "supervisor", "first_name": "Naveen", "last_name": "SV", "employee_code": "ARC101", "email_verified": true, "phone_verified": false}')::jsonb,
      'email',
      'arc101@arcolab.com',
      now(), now(), now()
    );
  END IF;
END $$;

-- User 3: ARC102 (Worker)
DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'arc102@arcolab.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      'arc102@arcolab.com',
      crypt('ARCOLAB102', gen_salt('bf', 10)),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"first_name": "Guest", "last_name": "User", "role": "worker", "employee_code": "ARC102"}'::jsonb,
      now(), now(), false
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      new_user_id,
      ('{"sub": "' || new_user_id || '", "email": "arc102@arcolab.com", "role": "worker", "first_name": "Guest", "last_name": "User", "employee_code": "ARC102", "email_verified": true, "phone_verified": false}')::jsonb,
      'email',
      'arc102@arcolab.com',
      now(), now(), now()
    );
  END IF;
END $$;
`;

  fs.writeFileSync(path.join(__dirname, 'setup-database.sql'), combinedSql, 'utf8');
  console.log('✅ Generated setup-database.sql successfully!');
}

main();
