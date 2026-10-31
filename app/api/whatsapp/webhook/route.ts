import fs from 'fs';
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

    try { fs.appendFileSync("/tmp/incoming-meta-webhooks.log", new Date().toISOString() + " " + JSON.stringify(body) + "\n"); } catch {}
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

    let metaPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
    const metaAccessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";

    // A. Meta WhatsApp Cloud API JSON (Graph API v21.0)
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0]?.changes?.[0]?.value;
      if (entry?.metadata?.phone_number_id) {
        metaPhoneNumberId = entry.metadata.phone_number_id;
      }
      const contact = entry?.contacts?.[0];
      const message = entry?.messages?.[0];

      // Ignore status-only webhook pings (delivered/read receipts)
      if (!message && entry?.statuses) {
        return NextResponse.json({ ok: true, statusPing: true });
      }

      phone = message?.from || contact?.wa_id || '';
      profileName = contact?.profile?.name || 'WhatsApp Guest';

      if (message?.type === 'text') {
        caption = message.text?.body || '';
      } else if (message?.type === 'image' || message?.type === 'document') {
        const mediaObj = message.type === 'image' ? message.image : message.document;
        caption = mediaObj?.caption || '';
        const mediaId = mediaObj?.id;
        const directLink = mediaObj?.link;
        let base64FromMeta: string | undefined;

        // Real 2-Step Meta Graph API v21.0 Media Download using WHATSAPP_ACCESS_TOKEN
        if (mediaId && metaAccessToken && !directLink) {
          try {
            const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
              headers: { Authorization: `Bearer ${metaAccessToken}` },
            });
            const metaJson = await metaRes.json();
            if (metaJson?.url) {
              const binRes = await fetch(metaJson.url, {
                headers: { Authorization: `Bearer ${metaAccessToken}` },
              });
              const arrayBuf = await binRes.arrayBuffer();
              const mime = mediaObj?.mime_type || "image/jpeg";
              base64FromMeta = `data:${mime};base64,${Buffer.from(arrayBuf).toString("base64")}`;
            }
          } catch (dlErr) {
            console.warn("Meta Graph media download warning:", dlErr);
          }
        }

        if (mediaId || directLink) {
          mediaItems.push({
            url: directLink || `https://graph.facebook.com/v21.0/${mediaId}`,
            base64: base64FromMeta,
            filename: mediaObj?.filename || `wa-${mediaId || Date.now()}.jpg`,
            sha256: mediaObj?.sha256?.replace(/[^a-fA-F0-9]/g, ""),
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
    // C. Whapi.Cloud / WAHA / Green-API Group & Direct Webhook Formats (2026 Linked-Device Gateways)
    else if (Array.isArray(body.messages) && body.messages[0]) {
      // Whapi.Cloud format
      const msg = body.messages[0];
      phone = msg.from || msg.chat_id?.replace(/@.+$/, "") || "+919876543210";
      profileName = msg.from_name || msg.pushname || "WhatsApp Guest";
      caption = msg.image?.caption || msg.text?.body || msg.caption || "";
      if (msg.image?.link || msg.image?.url) {
        mediaItems.push({
          url: msg.image.link || msg.image.url,
          filename: `whapi-${msg.id || Date.now()}.jpg`,
          sha256: msg.image.sha256,
        });
      }
    } else if (body.typeWebhook === "incomingMessageReceived" && body.messageData) {
      // Green-API format
      phone = body.senderData?.sender?.replace(/@.+$/, "") || "+919876543210";
      profileName = body.senderData?.senderName || body.senderData?.chatName || "WhatsApp Guest";
      caption = body.messageData?.fileMessageData?.caption || body.messageData?.textMessageData?.textMessage || "";
      if (body.messageData?.fileMessageData?.downloadUrl) {
        mediaItems.push({
          url: body.messageData.fileMessageData.downloadUrl,
          filename: body.messageData.fileMessageData.fileName || `greenapi-${Date.now()}.jpg`,
        });
      }
    } else if (body.event === "message" && body.payload) {
      // WAHA (WhatsApp HTTP API) format
      const p = body.payload;
      phone = (p.participant || p.from || "").replace(/@.+$/, "") || "+919876543210";
      profileName = p._data?.notifyName || p.notifyName || "WhatsApp Guest";
      caption = p.body || p.caption || "";
      if (p.mediaUrl || p.media?.url) {
        mediaItems.push({
          url: p.mediaUrl || p.media.url,
          filename: `waha-${p.id || Date.now()}.jpg`,
        });
      }
    }
    // D. In-App WhatsApp Simulator / Live Browser Bridge JSON
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

    // Support inline [Title: ...] or [Bride's Uncle] prefix in WhatsApp caption
    const bracketMatch = caption.match(/^\[(?:title:\s*)?([^\]]{2,40})\]\s*(.*)$/i);
    if (bracketMatch) {
      relationship = bracketMatch[1].trim();
      caption = bracketMatch[2].trim();
    }

    if (existingProfile) {
      const nextName =
        profileName && profileName !== "WhatsApp Guest" && profileName !== "Wedding Guest"
          ? profileName.trim()
          : existingProfile.display_name;
      const nextRel =
        relationship && relationship !== "Guest"
          ? relationship.trim()
          : existingProfile.relationship;

      if (nextName !== existingProfile.display_name || nextRel !== existingProfile.relationship) {
        const { data: updatedProfile } = await supabase
          .from("profiles")
          .update({ display_name: nextName, relationship: nextRel })
          .eq("id", existingProfile.id)
          .select("*")
          .single();
        uploader = (updatedProfile as Profile) || {
          ...existingProfile,
          display_name: nextName,
          relationship: nextRel,
        };
      } else {
        uploader = existingProfile;
      }
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

    // Generate 1-Tap Magic Timeline & Gallery Links using public HTTPS tunnel or forwarded host so phones can open it anywhere
    const forwardedHost = req.headers.get("x-forwarded-host");
    const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
    let liveTunnel = "https://f746e1a3f02107.lhr.life";
    try {
      if (fs.existsSync("/tmp/current-tunnel-url.txt")) {
        liveTunnel = fs.readFileSync("/tmp/current-tunnel-url.txt", "utf8").trim() || liveTunnel;
      }
    } catch {}
    let origin = process.env.NEXT_PUBLIC_APP_URL || liveTunnel;
    if (forwardedHost && !forwardedHost.includes("localhost")) {
      origin = `${forwardedProto}://${forwardedHost}`;
    }
    const baseAuthParams = `code=AISH2026&phone=${encodeURIComponent(normalizedPhone)}&name=${encodeURIComponent(uploader.display_name)}&rel=${encodeURIComponent(uploader.relationship)}`;
    const magicLink = `${origin}/?${baseAuthParams}&view=timeline`;
    const galleryLink = `${origin}/?${baseAuthParams}&view=gallery`;
    const myTimelineLink = `${origin}/?${baseAuthParams}&view=timeline&filter=MyUploads`;

    // -------------------------------------------------------------------------
    // 4. Handle Text-Only Greeting / Inquiries (e.g. "Hi", "Hello")
    // -------------------------------------------------------------------------
    if (mediaItems.length === 0) {
      const welcomeReply = `Namaste ${uploader.display_name} (${uploader.relationship})! 💍✨

Welcome to Aishwarya & Ashish's Wedding Moments Concierge!

📸 *Send me your photos anytime* directly in this chat, and they'll instantly appear in our Live Wedding Timeline & Shared Album!

💡 *Pro Tip:* Add #mehendi, #sangeet, or #wedding in your caption to automatically organize them into the event album!

✨ *Your Live Timeline:*
${magicLink}

🖼️ *Shared Photo Gallery:*
${galleryLink}`;

      if (body.object === "whatsapp_business_account" && metaAccessToken && metaPhoneNumberId && phone) {
        try {
          await fetch(`https://graph.facebook.com/v21.0/${metaPhoneNumberId}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${metaAccessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: phone.replace(/[^0-9]/g, ""),
              type: "text",
              text: {
                preview_url: true,
                body: welcomeReply,
              },
            }),
          });
        } catch (replyErr) {
          console.warn("Meta Graph welcome reply warning:", replyErr);
        }
      }

      return NextResponse.json({
        ok: true,
        botReply: welcomeReply,
        magicLink,
        galleryLink,
        insertedPhotos: 0,
        skippedDuplicates: 0,
      }, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Private-Network": "true",
        },
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
    const receiptCode = createdBatch?.id ? String(createdBatch.id).slice(0, 8).toUpperCase() : Math.random().toString(36).substring(2, 8).toUpperCase();
    if (insertedPhotos > 0) {
      botReply = `✅ *Upload Confirmed! (${insertedPhotos} photo${insertedPhotos > 1 ? 's' : ''} live on Timeline)* 🎉\n\n` +
        `👤 *Uploader:* ${uploader.display_name} (${uploader.relationship})\n` +
        `📂 *Event Album:* ${eventName}\n` +
        `📝 *Post Title:* "${caption || eventName + ' Moment'}"\n` +
        `🧾 *Receipt ID:* #AISH-${receiptCode}` +
        (skippedDuplicates > 0 ? `\n⚠️ *Duplicates Skipped:* ${skippedDuplicates} (SHA-256 verified)` : "");
    } else if (skippedDuplicates > 0) {
      botReply = `ℹ️ *Duplicate detected:* All ${skippedDuplicates} photo(s) were already in the wedding gallery (SHA-256 match). No duplicate was posted!`;
    } else {
      botReply = `Received your message! Tap below to open the live wedding gallery.`;
    }

    // If this came from Meta Cloud API and WHATSAPP_ACCESS_TOKEN is configured, send Interactive 2-Button WhatsApp Reply!
    if (body.object === "whatsapp_business_account" && metaAccessToken && metaPhoneNumberId && phone) {
      try {
        await fetch(`https://graph.facebook.com/v21.0/${metaPhoneNumberId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${metaAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phone.replace(/[^0-9]/g, ""),
            type: "interactive",
            interactive: {
              type: "button",
              body: {
                text: `${botReply}\n\nTap a button below or open:\n✨ Timeline: ${origin}/t\n🖼️ Gallery: ${origin}/g`,
              },
              action: {
                buttons: [
                  {
                    type: "reply",
                    reply: { id: "view_timeline", title: "✨ View Timeline" },
                  },
                  {
                    type: "reply",
                    reply: { id: "view_gallery", title: "🖼️ View Gallery" },
                  },
                ],
              },
            },
          }),
        });
      } catch (replyErr) {
        console.warn("Meta Graph outbound reply warning:", replyErr);
      }
    }

    return NextResponse.json({
      ok: true,
      botReply,
      magicLink,
      galleryLink,
      myTimelineLink,
      batch: createdBatch,
      insertedPhotos,
      skippedDuplicates,
      uploader,
    }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Private-Network": "true",
      },
    });
  } catch (err: unknown) {
    console.error('WhatsApp webhook error:', err);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ ok: false, error: message }, {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Private-Network": "true",
      },
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Access-Control-Request-Private-Network",
      "Access-Control-Allow-Private-Network": "true",
    },
  });
}
