#!/usr/bin/env node

/**
 * Live Supabase Seeder for AishHiAish Wedding Moments
 * Authored by Jack (support loaner agent)
 *
 * Idempotently populates:
 * 1. Storage bucket: wedding-photos under seed/sample-{i}.jpg
 * 2. public.profiles: 6 sample uploaders + Host profile (Sameer Goel)
 * 3. public.upload_batches: 6 batches linked to uploaders
 * 4. public.photos: 6 moments linked to batches and uploaders
 * 5. public.comments: initial reactions/comments by Family
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// 1. Read environment variables from .env.local
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
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
  }
  return env;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
}

console.log(`Connecting to Supabase at: ${supabaseUrl}`);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 2. Load DEMO_SAMPLES from lib/demo-samples.ts
const { DEMO_SAMPLES } = await import(path.join(projectRoot, 'lib', 'demo-samples.ts'));
console.log(`Loaded ${DEMO_SAMPLES.length} demo samples from lib/demo-samples.ts`);

// 3. Define target profiles mapping
const SAMPLE_PROFILES_META = [
  {
    id: 1,
    phone: '+919810000001',
    display_name: 'Neha',
    relationship: "Bride's Sister",
    role: 'family',
    avatar_color: '#ec4899',
    invite_code: 'AISH2026',
    event: 'Mehendi',
    caption: 'Mehendi magic ✨',
  },
  {
    id: 2,
    phone: '+919810000002',
    display_name: 'Rohan',
    relationship: "Groom's Squad",
    role: 'guest',
    avatar_color: '#3b82f6',
    invite_code: 'AISH2026',
    event: 'Sangeet',
    caption: 'The Sangeet squad has entered the chat 😂',
    initial_comment: {
      who: 'Family',
      text: 'This is going straight into the highlight reel 😂',
    },
  },
  {
    id: 3,
    phone: '+919810000003',
    display_name: 'Tanya',
    relationship: "Bride's Best Friend",
    role: 'guest',
    avatar_color: '#8b5cf6',
    invite_code: 'AISH2026',
    event: 'Wedding',
    caption: 'Our mandap looking like a dream 🌼',
  },
  {
    id: 4,
    phone: '+919810000004',
    display_name: 'Kriti',
    relationship: "Bride's Cousin",
    role: 'family',
    avatar_color: '#f43f5e',
    invite_code: 'AISH2026',
    event: 'Wedding',
    caption: 'All the little bridal details 💕',
  },
  {
    id: 5,
    phone: '+919810000005',
    display_name: 'Aman',
    relationship: 'College Friend',
    role: 'guest',
    avatar_color: '#10b981',
    invite_code: 'AISH2026',
    event: 'Sangeet',
    caption: 'Caught laughing at the speeches 😂',
    initial_comment: {
      who: 'Family',
      text: 'Everyone is having the best time!',
    },
  },
  {
    id: 6,
    phone: '+919810000006',
    display_name: 'Wedding Crew',
    relationship: 'Organizing Team',
    role: 'organizer',
    avatar_color: '#6366f1',
    invite_code: 'AISH2026',
    event: 'Wedding',
    caption: 'A walk into forever ♡',
  },
];

const HOST_PROFILE_META = {
  phone: '+919876543210',
  display_name: 'Sameer Goel',
  relationship: "Bride's Brother",
  role: 'host',
  avatar_color: '#f59e0b',
  invite_code: 'AISH2026',
};

async function seed() {
  console.log('\n--- Step 1: Idempotently Upsert Profiles ---');
  const allProfilesMeta = [...SAMPLE_PROFILES_META, HOST_PROFILE_META];
  const profileMap = new Map(); // phone -> profile record

  for (const p of allProfilesMeta) {
    const payload = {
      phone: p.phone,
      display_name: p.display_name,
      relationship: p.relationship,
      role: p.role,
      avatar_color: p.avatar_color,
      invite_code: p.invite_code,
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'phone' })
      .select()
      .single();

    if (error) {
      console.error(`Failed to upsert profile ${p.display_name} (${p.phone}):`, error);
      throw error;
    }

    profileMap.set(p.phone, data);
    console.log(`✓ Profile ready: [${data.role.toUpperCase()}] ${data.display_name} (${data.relationship}) -> ID: ${data.id}`);
  }

  const sameerProfile = profileMap.get(HOST_PROFILE_META.phone);
  if (!sameerProfile) {
    throw new Error('Host profile Sameer Goel was not created');
  }

  console.log('\n--- Step 2: Upload Samples to Supabase Storage (wedding-photos) ---');
  const uploadedPhotosMeta = [];

  for (const sampleMeta of SAMPLE_PROFILES_META) {
    const sample = DEMO_SAMPLES.find((s) => s.id === sampleMeta.id);
    if (!sample) {
      throw new Error(`Demo sample with ID ${sampleMeta.id} not found in DEMO_SAMPLES`);
    }

    const base64Data = sample.url.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const storagePath = `seed/sample-${sample.id}.jpg`;
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    console.log(`Uploading ${storagePath} (${buffer.length} bytes, sha256: ${fileHash.slice(0, 16)}...)...`);

    const { error: uploadError } = await supabase.storage
      .from('wedding-photos')
      .upload(storagePath, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error(`Failed to upload ${storagePath}:`, uploadError);
      throw uploadError;
    }

    const { data: pubData } = supabase.storage
      .from('wedding-photos')
      .getPublicUrl(storagePath);

    const publicUrl = pubData.publicUrl;
    console.log(`✓ Storage Uploaded: ${storagePath} -> ${publicUrl}`);

    uploadedPhotosMeta.push({
      sampleMeta,
      sample,
      buffer,
      storagePath,
      publicUrl,
      fileHash,
    });
  }

  console.log('\n--- Step 3: Idempotently Upsert Upload Batches & Photos ---');
  const photoMap = new Map(); // sample.id -> photo record
  const batchMap = new Map(); // sample.id -> batch record

  for (const item of uploadedPhotosMeta) {
    const { sampleMeta, buffer, storagePath, publicUrl, fileHash } = item;
    const uploader = profileMap.get(sampleMeta.phone);

    // Check or insert batch
    let batchRecord = null;
    const { data: existingBatches, error: batchQueryErr } = await supabase
      .from('upload_batches')
      .select('*')
      .eq('uploader_id', uploader.id)
      .eq('source', 'seed')
      .eq('event_name', sampleMeta.event);

    if (batchQueryErr) {
      throw batchQueryErr;
    }

    if (existingBatches && existingBatches.length > 0) {
      batchRecord = existingBatches[0];
      // update caption if changed
      await supabase
        .from('upload_batches')
        .update({ caption: sampleMeta.caption })
        .eq('id', batchRecord.id);
    } else {
      const { data: newBatch, error: batchInsertErr } = await supabase
        .from('upload_batches')
        .insert({
          uploader_id: uploader.id,
          event_name: sampleMeta.event,
          caption: sampleMeta.caption,
          source: 'seed',
          photo_count: 1,
        })
        .select()
        .single();

      if (batchInsertErr) throw batchInsertErr;
      batchRecord = newBatch;
    }

    batchMap.set(sampleMeta.id, batchRecord);
    console.log(`✓ Batch ready for ${uploader.display_name} (${sampleMeta.event}) -> ID: ${batchRecord.id}`);

    // Upsert photo (unique constraint on uploader_id, file_hash)
    const photoPayload = {
      batch_id: batchRecord.id,
      uploader_id: uploader.id,
      storage_path: storagePath,
      public_url: publicUrl,
      original_filename: `sample-${sampleMeta.id}.jpg`,
      file_hash: fileHash,
      file_size: buffer.length,
      width: 1200,
      height: 900,
      event_name: sampleMeta.event,
      caption: sampleMeta.caption,
      source: 'seed',
      likes_count: 0,
      is_hidden: false,
    };

    const { data: photoRecord, error: photoErr } = await supabase
      .from('photos')
      .upsert(photoPayload, { onConflict: 'uploader_id,file_hash' })
      .select()
      .single();

    if (photoErr) {
      console.error(`Failed to upsert photo for sample ${sampleMeta.id}:`, photoErr);
      throw photoErr;
    }

    photoMap.set(sampleMeta.id, photoRecord);
    console.log(`✓ Photo ready: sample-${sampleMeta.id}.jpg -> ID: ${photoRecord.id}`);
  }

  console.log('\n--- Step 4: Idempotently Upsert Initial Comments ---');
  let commentsSeeded = 0;

  for (const sampleMeta of SAMPLE_PROFILES_META) {
    if (!sampleMeta.initial_comment) continue;

    const photo = photoMap.get(sampleMeta.id);
    const batch = batchMap.get(sampleMeta.id);
    const commentBody = sampleMeta.initial_comment.text;
    const commentWho = sampleMeta.initial_comment.who;

    // Check if this comment already exists for this photo
    const { data: existingComments, error: commentQueryErr } = await supabase
      .from('comments')
      .select('*')
      .eq('photo_id', photo.id)
      .eq('body', commentBody);

    if (commentQueryErr) throw commentQueryErr;

    if (existingComments && existingComments.length > 0) {
      console.log(`✓ Comment already exists for Photo #${sampleMeta.id}: "${commentBody}" -> ID: ${existingComments[0].id}`);
      commentsSeeded++;
    } else {
      const { data: newComment, error: commentInsertErr } = await supabase
        .from('comments')
        .insert({
          photo_id: photo.id,
          batch_id: batch.id,
          author_id: sameerProfile.id,
          author_name: commentWho,
          author_relationship: 'Family',
          body: commentBody,
        })
        .select()
        .single();

      if (commentInsertErr) {
        console.error(`Failed to insert comment for photo ${photo.id}:`, commentInsertErr);
        throw commentInsertErr;
      }

      console.log(`✓ Comment inserted for Photo #${sampleMeta.id} by ${commentWho}: "${commentBody}" -> ID: ${newComment.id}`);
      commentsSeeded++;
    }
  }

  console.log('\n--- Step 5: Verification & Persistence Audit ---');
  const { data: finalProfiles } = await supabase.from('profiles').select('id, phone, display_name, relationship, role');
  const { data: finalBatches } = await supabase.from('upload_batches').select('id, event_name, caption, source, photo_count');
  const { data: finalPhotos } = await supabase.from('photos').select('id, storage_path, public_url, event_name, caption, file_hash');
  const { data: finalComments } = await supabase.from('comments').select('id, photo_id, author_name, author_relationship, body');
  const { data: storageObjects, error: storageErr } = await supabase.storage.from('wedding-photos').list('seed');

  console.log('='.repeat(70));
  console.log(`LIVE DATABASE & STORAGE SUMMARY (${supabaseUrl})`);
  console.log('='.repeat(70));
  console.log(`• Profiles count:       ${finalProfiles?.length || 0}`);
  console.log(`• Upload Batches count: ${finalBatches?.length || 0}`);
  console.log(`• Photos count:         ${finalPhotos?.length || 0}`);
  console.log(`• Comments count:       ${finalComments?.length || 0}`);
  console.log(`• Storage (seed/) files: ${storageObjects?.length || 0}`);
  console.log('-'.repeat(70));

  console.log('\nPhotos in Supabase Storage & Database:');
  for (const ph of finalPhotos || []) {
    console.log(`  [${ph.event_name.padEnd(7)}] ${ph.storage_path.padEnd(18)} | Caption: "${ph.caption}"`);
    console.log(`               Public URL: ${ph.public_url}`);
  }

  console.log('\nComments:');
  for (const c of finalComments || []) {
    console.log(`  [Photo ID: ${c.photo_id.slice(0, 8)}...] ${c.author_name} (${c.author_relationship}): "${c.body}"`);
  }

  console.log('='.repeat(70));
  console.log('Seeding completed successfully!');
}

seed().catch((err) => {
  console.error('Seeding script failed with error:', err);
  process.exit(1);
});
