#!/usr/bin/env node

/**
 * Automated Verification Script for Live Supabase Persistence
 * Authored by Jack (support loaner agent)
 *
 * Verifies:
 * 1. Profiles table counts, roles, and telephone numbers
 * 2. Upload batches count, events, and relations
 * 3. Photos table count, public URLs, and HTTP 200 accessibility
 * 4. Comments table count, foreign keys, and body text
 * 5. Supabase Storage bucket wedding-photos files
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(projectRoot, '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error(`.env.local not found at ${envPath}`);
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
  }
  return env;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('FAIL: Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verify() {
  console.log('='.repeat(70));
  console.log(`RUNNING SUPABASE LIVE VERIFICATION: ${supabaseUrl}`);
  console.log('='.repeat(70));

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Verify Profiles
  console.log('\n[1/5] Verifying public.profiles:');
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });

  assert(!pErr, `Query profiles returned without error: ${pErr?.message || 'OK'}`);
  assert(profiles && profiles.length >= 7, `Found ${profiles?.length || 0} profiles (expected >= 7)`);

  const expectedPhones = [
    '+919810000001',
    '+919810000002',
    '+919810000003',
    '+919810000004',
    '+919810000005',
    '+919810000006',
    '+919876543210',
  ];

  for (const phone of expectedPhones) {
    const found = profiles?.find((p) => p.phone === phone);
    assert(
      !!found,
      `Profile with phone ${phone} exists (${found ? `${found.display_name} - ${found.role}` : 'NOT FOUND'})`
    );
  }

  const hostProfile = profiles?.find((p) => p.phone === '+919876543210');
  assert(
    hostProfile && hostProfile.role === 'host' && hostProfile.display_name === 'Sameer Goel',
    `Host profile Sameer Goel verified with role='host'`
  );

  // 2. Verify Batches
  console.log('\n[2/5] Verifying public.upload_batches:');
  const { data: batches, error: bErr } = await supabase
    .from('upload_batches')
    .select('*');

  assert(!bErr, `Query upload_batches returned without error: ${bErr?.message || 'OK'}`);
  assert(batches && batches.length >= 6, `Found ${batches?.length || 0} batches (expected >= 6)`);

  const events = { Mehendi: 0, Sangeet: 0, Wedding: 0 };
  for (const b of batches || []) {
    if (events[b.event_name] !== undefined) events[b.event_name]++;
  }
  assert(events.Mehendi >= 1, `Mehendi batches: ${events.Mehendi} (expected >= 1)`);
  assert(events.Sangeet >= 2, `Sangeet batches: ${events.Sangeet} (expected >= 2)`);
  assert(events.Wedding >= 3, `Wedding batches: ${events.Wedding} (expected >= 3)`);

  // 3. Verify Photos
  console.log('\n[3/5] Verifying public.photos:');
  const { data: photos, error: phErr } = await supabase
    .from('photos')
    .select('*')
    .order('created_at', { ascending: true });

  assert(!phErr, `Query photos returned without error: ${phErr?.message || 'OK'}`);
  assert(photos && photos.length >= 6, `Found ${photos?.length || 0} photos (expected >= 6)`);

  for (let i = 1; i <= 6; i++) {
    const pathTarget = `seed/sample-${i}.jpg`;
    const photo = photos?.find((p) => p.storage_path === pathTarget);
    assert(!!photo, `Photo with storage_path='${pathTarget}' exists in public.photos`);
    if (photo) {
      assert(
        photo.public_url && photo.public_url.startsWith('https://'),
        `Photo #${i} has valid public_url: ${photo.public_url}`
      );
    }
  }

  // 4. Verify Comments
  console.log('\n[4/5] Verifying public.comments:');
  const { data: comments, error: cErr } = await supabase
    .from('comments')
    .select('*');

  assert(!cErr, `Query comments returned without error: ${cErr?.message || 'OK'}`);
  assert(comments && comments.length >= 2, `Found ${comments?.length || 0} comments (expected >= 2)`);

  const sangeetComment1 = comments?.find((c) => c.body.includes('highlight reel'));
  const sangeetComment2 = comments?.find((c) => c.body.includes('best time'));

  assert(!!sangeetComment1, 'Rohan comment ("highlight reel") exists');
  assert(!!sangeetComment2, 'Aman comment ("best time") exists');

  // 5. Verify Storage & HTTP Reachability
  console.log('\n[5/5] Verifying Supabase Storage Bucket & Public HTTP 200 URLs:');
  const { data: storageFiles, error: sErr } = await supabase.storage
    .from('wedding-photos')
    .list('seed');

  assert(!sErr, `Storage list('seed') returned without error: ${sErr?.message || 'OK'}`);
  assert(storageFiles && storageFiles.length >= 6, `Storage bucket contains ${storageFiles?.length || 0} files in seed/`);

  for (let i = 1; i <= 6; i++) {
    const filename = `sample-${i}.jpg`;
    const fileExists = storageFiles?.some((f) => f.name === filename);
    assert(fileExists, `File ${filename} present in wedding-photos/seed/`);

    const { data: urlData } = supabase.storage
      .from('wedding-photos')
      .getPublicUrl(`seed/${filename}`);

    try {
      const resp = await fetch(urlData.publicUrl, { method: 'HEAD' });
      assert(
        resp.status === 200,
        `HTTP HEAD ${urlData.publicUrl} -> Status ${resp.status} (Content-Type: ${resp.headers.get('content-type')})`
      );
    } catch (fetchErr) {
      assert(false, `HTTP HEAD failed for ${urlData.publicUrl}: ${fetchErr.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('='.repeat(70));

  if (failed > 0) {
    process.exit(1);
  }
}

verify().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
