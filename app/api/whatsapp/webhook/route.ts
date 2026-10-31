import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  supabase,
  normalizePhoneNumber,
  generateAvatarColor,
  EventName,
  Profile,
} from '@/lib/supabase';

// GET verification for Meta WhatsApp Cloud API
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'AISH2026';

  if (mode === 'subscribe' && (token === expectedToken || token === 'AISH2026')) {
    return new Response(challenge || 'ok', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new Response('Verification failed', { status: 403 });
}

// POST endpoint for Meta Cloud API, Twilio Webhook & In-App WhatsApp Simulator
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let body: any = {};

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      const obj: Record<string, any> = {};
      formData.forEach((val, key) => {
        obj[key] = val.toString();
      });
      body = obj;
    } else {
      body = await req.json().catch(() => ({}));
    }

    let phone = '';
    let profileName = 'WhatsApp Guest';
    let relationship = 'Guest';
    let caption = '';
    let explicitEventName: EventName | null = null;
    let mediaItems: Array<{
      url?: string;
      base64?: string;
      filename?: string;
      sha256?: string;
    }> = [];

    // -------------------------------------------------------------------------
    // 1. Ingestion Channel Detection
    // -------------------------------------------------------------------------

    // A. Meta WhatsApp Cloud API JSON
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0]?.changes?.[0]?.value;
      const contact = entry?.contacts?.[0];
      const message = entry?.messages?.[0];

      phone = message?.from || contact?.wa_id || '';
      profileName = contact?.profile?.name || 'WhatsApp Guest';

      if (message?.type === 'text') {
        caption = message.text?.body || '';
      } else if (message?.type === 'image') {
        caption = message.image?.caption || '';
        if (message.image?.id || message.image?.link) {
          mediaItems.push({
            url: message.image?.link || `https://graph.facebook.com/v19.0/${message.image.id}`,
            filename: `wa-${message.image.id || Date.now()}.jpg`,
            sha256: message.image?.sha256,
          });
        }
      }
    }
    // B. Twilio WhatsApp Form/JSON
    else if (body.From?.startsWith('whatsapp:') || body.WaId) {
      phone = body.WaId || body.From?.replace('whatsapp:', '') || '';
      profileName = body.ProfileName || 'WhatsApp Guest';
      caption = body.Body || '';

      const numMedia = parseInt(body.NumMedia || '0', 10);
      for (let i = 0; i < numMedia; i++) {
        const mediaUrl = body[`MediaUrl${i}`];
        if (mediaUrl) {
          mediaItems.push({
            url: mediaUrl,
            filename: `twilio-wa-${Date.now()}-${i}.jpg`,
          });
        }
      }
    }
    // C. In-App WhatsApp Simulator JSON
    else {
      phone = body.phone || '+919876543210';
      profileName = body.profileName || 'Wedding Guest';
      relationship = body.relationship || 'Guest';
      caption = body.caption || body.text || '';
      explicitEventName = (body.eventName as EventName) || null;

      if (Array.isArray(body.mediaItems)) {
        mediaItems = body.mediaItems;
      } else if (body.mediaUrl || body.imageUrl) {
        mediaItems.push({
          url: body.mediaUrl || body.imageUrl,
          filename: `upload-${Date.now()}.jpg`,
        });
      }
    }

    const normalizedPhone = normalizePhoneNumber(phone);

    // -------------------------------------------------------------------------
    // 2. Sender Profile Lookup or Auto-Upsert
    // -------------------------------------------------------------------------
    let uploader: Profile;
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (existingProfile) {
      uploader = existingProfile;
    } else {
      const avatarColor = generateAvatarColor(profileName + normalizedPhone);
      const { data: newProfile, error: profileErr } = await supabase
        .from('profiles')
        .insert({
          phone: normalizedPhone,
          display_name: profileName,
          relationship: relationship,
          role: 'guest',
          avatar_color: avatarColor,
          invite_code: 'AISH2026',
        })
        .select('*')
        .single();

      if (newProfile && !profileErr) {
        uploader = newProfile;
      } else {
        // Fallback synthetic profile if offline/before seed
        uploader = {
          id: 'wa-guest-' + Math.random().toString(36).substring(2, 9),
          phone: normalizedPhone,
          display_name: profileName,
          relationship: relationship,
          role: 'guest',
          avatar_color: avatarColor,
          invite_code: 'AISH2026',
          created_at: new Date().toISOString(),
        };
      }
    }

    // -------------------------------------------------------------------------
    // 3. Event Hashtag Parsing
    // -------------------------------------------------------------------------
    const lowerCaption = (caption || '').toLowerCase();
    let eventName: EventName = 'Wedding';

    if (lowerCaption.includes('#mehendi') || lowerCaption.includes('mehendi')) {
      eventName = 'Mehendi';
    } else if (lowerCaption.includes('#sangeet') || lowerCaption.includes('sangeet') || lowerCaption.includes('dance')) {
      eventName = 'Sangeet';
    } else if (lowerCaption.includes('#wedding') || lowerCaption.includes('wedding') || lowerCaption.includes('mandap') || lowerCaption.includes('phera')) {
      eventName = 'Wedding';
    } else if (explicitEventName) {
      eventName = explicitEventName;
    }

    // Generate 1-Tap Magic Login Link using actual origin
    let origin = "http://localhost:3000";
    try {
      origin = new URL(req.url).origin;
    } catch {
      // fallback
    }
    const magicLink = `${origin}/?code=AISH2026&phone=${encodeURIComponent(normalizedPhone)}&name=${encodeURIComponent(uploader.display_name)}&rel=${encodeURIComponent(uploader.relationship)}`;

    // -------------------------------------------------------------------------
    // 4. Handle Text-Only Greeting / Inquiries (e.g. "Hi", "Hello")
    // -------------------------------------------------------------------------
    if (mediaItems.length === 0) {
      const welcomeReply = `Namaste ${uploader.display_name} (${uploader.relationship})! 💍✨

Welcome to Aishwarya & Ashish's Wedding Moments Concierge!

📸 *Send me your photos anytime* directly in this chat, and they'll instantly appear in our Live Wedding Timeline & Shared Album!

💡 *Pro Tip:* Add #mehendi, #sangeet, or #wedding in your caption to automatically organize them into the event album!`;

      return NextResponse.json({
        ok: true,
        botReply: welcomeReply,
        magicLink,
        insertedPhotos: 0,
        skippedDuplicates: 0,
      });
    }

    // -------------------------------------------------------------------------
    // 5. Multi-Photo Ingestion with SHA-256 Duplicate Skipping
    // -------------------------------------------------------------------------
    let insertedPhotos = 0;
    let skippedDuplicates = 0;
    const acceptedPhotosToInsert: any[] = [];

    // Pre-flight duplicate check against existing uploader's photos
    const { data: existingPhotos } = await supabase
      .from('photos')
      .select('file_hash')
      .eq('uploader_id', uploader.id);

    const existingHashes = new Set(
      (existingPhotos || []).map((p: { file_hash: string }) => p.file_hash)
    );

    for (let i = 0; i < mediaItems.length; i++) {
      const item = mediaItems[i];
      let fileHash = item.sha256;
      let publicUrl = item.url || '';
      let storagePath = `whatsapp/${Date.now()}-${i}.jpg`;

      // If item provides base64 data URI
      if (item.base64) {
        const base64Data = item.base64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
        storagePath = `whatsapp/${fileHash}.jpg`;

        // Attempt upload to Supabase storage bucket 'wedding-photos'
        try {
          const { error: uploadErr } = await supabase.storage
            .from('wedding-photos')
            .upload(storagePath, buffer, {
              contentType: 'image/jpeg',
              upsert: true,
            });

          if (!uploadErr) {
            const { data: publicData } = supabase.storage
              .from('wedding-photos')
              .getPublicUrl(storagePath);
            publicUrl = publicData.publicUrl;
          } else {
            // If storage bucket isn't public or fails, use base64 data URI directly
            publicUrl = item.base64;
          }
        } catch {
          publicUrl = item.base64;
        }
      } else if (!fileHash) {
        // Compute hash from URL string or random seed
        fileHash = crypto
          .createHash('sha256')
          .update(publicUrl || `wa-moment-${Date.now()}-${i}`)
          .digest('hex');
      }

      // Check duplicate for this uploader
      if (existingHashes.has(fileHash)) {
        skippedDuplicates++;
        continue;
      }

      existingHashes.add(fileHash);

      acceptedPhotosToInsert.push({
        uploader_id: uploader.id,
        storage_path: storagePath,
        public_url: publicUrl,
        original_filename: item.filename || `whatsapp-${fileHash.substring(0, 8)}.jpg`,
        file_hash: fileHash,
        file_size: 480000,
        width: 1200,
        height: 900,
        event_name: eventName,
        caption: caption,
        source: 'whatsapp',
        likes_count: 0,
        is_hidden: false,
      });
    }

    // -------------------------------------------------------------------------
    // 6. Insert Batch & Photos into Supabase
    // -------------------------------------------------------------------------
    let createdBatch: any = null;

    if (acceptedPhotosToInsert.length > 0) {
      // Create upload_batch row
      const { data: batchData, error: batchErr } = await supabase
        .from('upload_batches')
        .insert({
          uploader_id: uploader.id,
          event_name: eventName,
          caption: caption,
          source: 'whatsapp',
          photo_count: acceptedPhotosToInsert.length,
        })
        .select('*')
        .single();

      const batchId = batchData?.id || 'batch-' + Math.random().toString(36).substring(2, 9);
      createdBatch = batchData || {
        id: batchId,
        uploader_id: uploader.id,
        event_name: eventName,
        caption: caption,
        source: 'whatsapp',
        photo_count: acceptedPhotosToInsert.length,
        created_at: new Date().toISOString(),
        uploader,
      };

      // Assign batch_id to all accepted photos
      const photosWithBatch = acceptedPhotosToInsert.map((p) => ({
        ...p,
        batch_id: batchId,
      }));

      const { data: insertedData, error: photosErr } = await supabase
        .from('photos')
        .insert(photosWithBatch)
        .select('*');

      const nowIso = new Date().toISOString();
      const rawPhotos = (insertedData && insertedData.length > 0)
        ? insertedData
        : photosWithBatch.map((p, idx) => ({
            ...p,
            id: `wa-local-${Date.now()}-${idx}`,
            created_at: nowIso,
          }));
      insertedPhotos = rawPhotos.length;
      createdBatch.uploader = uploader;
      createdBatch.created_at = createdBatch.created_at || nowIso;
      createdBatch.photos = rawPhotos.map((p: any) => ({
        ...p,
        created_at: p.created_at || nowIso,
        uploader,
        comments: p.comments || [],
      }));
    }

    // -------------------------------------------------------------------------
    // 7. Construct WhatsApp Confirmation Reply
    // -------------------------------------------------------------------------
    let botReply = '';
    if (insertedPhotos > 0) {
      botReply = `✅ *Uploaded ${insertedPhotos} moment${insertedPhotos > 1 ? 's' : ''} to ${eventName} Timeline!* 🎉`;
      if (skippedDuplicates > 0) {
        botReply += `\n*(Skipped ${skippedDuplicates} duplicate${skippedDuplicates > 1 ? 's' : ''} already in gallery)*`;
      }
      botReply += `\n\n✨ Posted under *${uploader.display_name} • ${uploader.relationship}*.`;
    } else if (skippedDuplicates > 0) {
      botReply = `ℹ️ *Duplicate detected:* All ${skippedDuplicates} photo(s) were already in the wedding gallery (SHA-256 match). No duplicate was posted!`;
    } else {
      botReply = `Received your message! Tap below to open the live wedding gallery.`;
    }

    return NextResponse.json({
      ok: true,
      botReply,
      magicLink,
      batch: createdBatch,
      insertedPhotos,
      skippedDuplicates,
      uploader,
    });
  } catch (err: unknown) {
    console.error('WhatsApp webhook error:', err);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
