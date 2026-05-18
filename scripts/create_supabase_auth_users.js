/*
Create Supabase Auth users using service_role key.

Usage:
  SUPABASE_URL=https://<project>.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
  node create_supabase_auth_users.js users.json

Where users.json is an array of objects: [{"email":"a@b.com","password":"P@ssw0rd"}, ...]

This script calls the admin REST endpoint: POST /auth/v1/admin/users
*/

import fs from 'fs';
import path from 'path';

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
    process.exit(1);
  }

  const argv = process.argv.slice(2);
  if (argv.length < 1) {
    console.error('Usage: node create_supabase_auth_users.js users.json');
    process.exit(1);
  }

  const file = path.resolve(process.cwd(), argv[0]);
  if (!fs.existsSync(file)) {
    console.error('File not found:', file);
    process.exit(1);
  }

  const content = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(content)) {
    console.error('users.json must be an array of {email,password} objects');
    process.exit(1);
  }

  for (const user of content) {
    if (!user.email) {
      console.warn('Skipping entry without email:', user);
      continue;
    }
    const payload = {
      email: user.email,
      password: user.password || user.pass || null,
      email_confirm: true
    };

    try {
      const res = await fetch(new URL('/auth/v1/admin/users', url).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`
        },
        body: JSON.stringify(payload)
      });

      const resBody = await res.text();
      if (!res.ok) {
        console.error(`Failed creating ${user.email}: ${res.status} ${res.statusText} - ${resBody}`);
        continue;
      }

      let created;
      try { created = JSON.parse(resBody); } catch (e) { created = null; }
      if (!created || !created.id) {
        console.error(`Auth admin API returned no id for ${user.email}: ${resBody}`);
        continue;
      }
      console.log(`Created auth user ${user.email} (id=${created.id})`);

      // Prepare profile row for public.auth_users
      const username = user.username || (user.email ? user.email.split('@')[0] : null);
      const profile = {
        email: user.email,
        username: username,
        full_name: user.full_name || username,
        role_id: user.role_id || 1,
        is_active: typeof user.is_active !== 'undefined' ? user.is_active : 1,
        auth_user_id: created.id
      };

      // Insert or update public.auth_users via REST API (service role key)
      try {
        // Check existing by email
        const queryUrl = new URL('/rest/v1/auth_users', url);
        queryUrl.searchParams.set('email', `eq.${user.email}`);
        queryUrl.searchParams.set('select', '*');

        const getRes = await fetch(queryUrl.toString(), {
          method: 'GET',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`
          }
        });

        const existingBody = await getRes.text();
        let existing = null;
        try { existing = JSON.parse(existingBody); } catch (e) { existing = null; }

        if (Array.isArray(existing) && existing.length > 0) {
          const row = existing[0];
          // PATCH update existing row
          const patchUrl = new URL(`/rest/v1/auth_users?id=eq.${row.id}`, url).toString();
          const patchRes = await fetch(patchUrl, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              Prefer: 'return=representation'
            },
            body: JSON.stringify(profile)
          });

          const patchBody = await patchRes.text();
          if (!patchRes.ok) {
            console.error(`Failed updating profile for ${user.email}: ${patchRes.status} ${patchRes.statusText} - ${patchBody}`);
          } else {
            console.log(`Updated profile for ${user.email}`);
          }
        } else {
          // POST create
          const insertRes = await fetch(new URL('/rest/v1/auth_users', url).toString(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              Prefer: 'return=representation'
            },
            body: JSON.stringify(profile)
          });

          const insertBody = await insertRes.text();
          if (!insertRes.ok) {
            console.error(`Failed inserting profile for ${user.email}: ${insertRes.status} ${insertRes.statusText} - ${insertBody}`);
          } else {
            console.log(`Inserted profile for ${user.email}`);
          }
        }
      } catch (err) {
        console.error('Error inserting/updating profile for', user.email, err);
      }
    } catch (err) {
      console.error('Error creating user', user.email, err);
    }
  }
}

main();
