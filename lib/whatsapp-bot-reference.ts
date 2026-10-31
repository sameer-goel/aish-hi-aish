/**
 * WhatsApp Bot Reference Specification & Normalization Module
 * Project: AishHiAish Wedding Moments (#AishHiAish)
 * Grounded in:
 *   - Meta WhatsApp Cloud API (Graph API v21.0)
 *   - Twilio Messaging Webhook Specification
 *   - AishHiAish Production Schema (supabase/schema.sql)
 *   - Interactive Reference Demo (REFERENCE_AUDIT.md)
 *
 * Zero external runtime dependencies.
 * Auditor: Satya (Reference & Anti-Hallucination Auditor)
 */

// =============================================================================
// 1. DOMAIN CONSTANTS & CANONICAL VALUES
// =============================================================================

export const DEFAULT_INVITE_CODE = 'AISH2026';

export const WEDDING_EVENTS = ['Mehendi', 'Sangeet', 'Wedding'] as const;
export type WeddingEventName = (typeof WEDDING_EVENTS)[number];

export const CANONICAL_RELATIONSHIPS = [
  "Bride's Sister / Cousin",
  "Groom's Squad",
  "Bride's Best Friend",
  'Family',
  'College Friend',
  'Organizing Team',
  'Guest',
] as const;
export type CanonicalRelationship = (typeof CANONICAL_RELATIONSHIPS)[number];

export type WhatsAppIntent =
  | 'greeting'
  | 'set_relationship'
  | 'upload_photos'
  | 'magic_link'
  | 'status';

// =============================================================================
// 2. META WHATSAPP CLOUD API (GRAPH API v21.0) SPECIFICATION
// =============================================================================

export interface MetaWhatsAppMediaRef {
  id: string;
  mime_type: string;
  sha256?: string;
  caption?: string;
  filename?: string;
}

export interface MetaWhatsAppMessage {
  from: string; // E.g. "919876543210"
  id: string; // E.g. "wamid.HBgLOTE..."
  timestamp: string; // Unix epoch string
  type:
    | 'text'
    | 'image'
    | 'video'
    | 'document'
    | 'audio'
    | 'interactive'
    | 'button'
    | string;
  text?: {
    body: string;
  };
  image?: MetaWhatsAppMediaRef;
  video?: MetaWhatsAppMediaRef;
  document?: MetaWhatsAppMediaRef;
  interactive?: {
    type: 'button_reply' | 'list_reply' | string;
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description?: string;
    };
  };
}

export interface MetaWhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string; // Phone number without '+'
}

export interface MetaWhatsAppChangeValue {
  messaging_product: 'whatsapp' | string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: MetaWhatsAppContact[];
  messages?: MetaWhatsAppMessage[];
  statuses?: Array<{
    id: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    timestamp: string;
    recipient_id: string;
  }>;
}

export interface MetaWhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: Array<{
    id: string;
    changes: Array<{
      field: 'messages' | string;
      value: MetaWhatsAppChangeValue;
    }>;
  }>;
}

// =============================================================================
// 3. TWILIO WHATSAPP WEBHOOK SPECIFICATION
// =============================================================================

export interface TwilioWhatsAppWebhookPayload {
  From: string; // E.g. "whatsapp:+919876543210"
  WaId?: string; // E.g. "919876543210"
  To?: string; // E.g. "whatsapp:+14155238886"
  ProfileName?: string; // E.g. "Aarav Sharma"
  Body?: string; // Message caption / body
  NumMedia?: string | number; // E.g. "1" or 1
  MediaUrl0?: string;
  MediaUrl1?: string;
  MediaUrl2?: string;
  MediaUrl3?: string;
  MediaUrl4?: string;
  MediaUrl5?: string;
  MediaUrl6?: string;
  MediaUrl7?: string;
  MediaUrl8?: string;
  MediaUrl9?: string;
  MediaContentType0?: string;
  MediaContentType1?: string;
  MediaContentType2?: string;
  MediaContentType3?: string;
  MediaContentType4?: string;
  MediaContentType5?: string;
  MediaContentType6?: string;
  MediaContentType7?: string;
  MediaContentType8?: string;
  MediaContentType9?: string;
  MessageSid?: string;
  SmsSid?: string;
  AccountSid?: string;
  [key: string]: unknown;
}

// =============================================================================
// 4. SIMULATOR PAYLOAD (IN-APP INTERACTIVE WHATSAPP BOT SIMULATOR)
// =============================================================================

export interface SimulatedWhatsAppMediaItem {
  url: string;
  filename?: string;
  fileHash?: string;
  mimeType?: string;
}

export interface SimulatedWhatsAppMessagePayload {
  phone: string;
  profileName: string;
  relationship?: string;
  body: string;
  eventName?: WeddingEventName;
  mediaItems?: SimulatedWhatsAppMediaItem[];
}

// =============================================================================
// 5. UNIFIED NORMALIZED WHATSAPP TURN RESULT
// =============================================================================

export interface WhatsAppMediaItem {
  url: string;
  filename?: string;
  fileHash?: string;
  mimeType?: string;
}

export interface NormalizedWhatsAppTurn {
  phone: string;
  profileName: string;
  relationship: string;
  intent: WhatsAppIntent;
  eventName: WeddingEventName;
  caption: string;
  mediaItems: WhatsAppMediaItem[];
  botReplyText: string;
  magicLoginUrl: string;
}

// =============================================================================
// 6. TYPE GUARDS
// =============================================================================

export function isMetaWhatsAppWebhookPayload(
  payload: unknown
): payload is MetaWhatsAppWebhookPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return (
    p.object === 'whatsapp_business_account' &&
    Array.isArray(p.entry) &&
    p.entry.length > 0
  );
}

export function isTwilioWhatsAppWebhookPayload(
  payload: unknown
): payload is TwilioWhatsAppWebhookPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.From === 'string' &&
    (p.From.startsWith('whatsapp:') || typeof p.WaId === 'string' || typeof p.NumMedia !== 'undefined')
  );
}

export function isSimulatedWhatsAppMessagePayload(
  payload: unknown
): payload is SimulatedWhatsAppMessagePayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return typeof p.phone === 'string' && typeof p.profileName === 'string' && typeof p.body === 'string';
}

// =============================================================================
// 7. HELPER UTILITIES: SANITIZATION, HASHTAG, INTENT & RELATIONSHIP DETECTION
// =============================================================================

/**
 * Standardize phone numbers to international E.164-compatible format:
 * "whatsapp:+919876543210" -> "+919876543210"
 * "919876543210"           -> "+919876543210"
 */
export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '+919876543210';
  let cleaned = rawPhone.trim().replace(/^whatsapp:/i, '');
  cleaned = cleaned.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    cleaned = `+${cleaned}`;
  }
  return cleaned;
}

/**
 * Detect event from hashtag (#mehendi, #sangeet, #wedding, etc.) or caption keywords.
 * Defaults to 'Wedding' as per supabase/schema.sql table upload_batches.
 */
export function detectWeddingEvent(
  text: string,
  preferredEvent?: WeddingEventName
): WeddingEventName {
  if (!text && preferredEvent && WEDDING_EVENTS.includes(preferredEvent)) {
    return preferredEvent;
  }
  const lower = (text || '').toLowerCase();

  // 1. Explicit hashtags have the highest priority
  if (/#(?:mehendi|mehndi)\b/i.test(lower)) return 'Mehendi';
  if (/#sangeet\b/i.test(lower)) return 'Sangeet';
  if (/#(?:wedding|shaadi|mandap|vivaah)\b/i.test(lower)) return 'Wedding';

  // 2. Keyword fallback in message body
  if (/\b(?:mehendi|mehndi|henna)\b/i.test(lower)) return 'Mehendi';
  if (/\b(?:sangeet|dance|squad entry)\b/i.test(lower)) return 'Sangeet';
  if (/\b(?:wedding|mandap|pheras|shaadi|vivaah|varmala)\b/i.test(lower)) return 'Wedding';

  // 3. Fallback to preferred event if provided, otherwise default 'Wedding'
  if (preferredEvent && WEDDING_EVENTS.includes(preferredEvent)) {
    return preferredEvent;
  }
  return 'Wedding';
}

/**
 * Detect or extract guest relationship from caption or parameter.
 * Matches the canonical roles established in REFERENCE_AUDIT.md.
 */
export function detectRelationship(
  text: string,
  explicitRelationship?: string
): string {
  if (explicitRelationship && explicitRelationship.trim() && explicitRelationship.trim() !== 'Guest') {
    const trimmed = explicitRelationship.trim();
    // Return exact match if canonical
    const canonicalMatch = CANONICAL_RELATIONSHIPS.find(
      (r) => r.toLowerCase() === trimmed.toLowerCase()
    );
    if (canonicalMatch) return canonicalMatch;
    return trimmed;
  }

  const lower = (text || '').toLowerCase();

  // Explicit prefix e.g. "rel: Bride's Sister", "relationship: Groom's Squad", "i am Bride's Best Friend"
  const prefixMatch = text.match(/(?:rel|relationship|role)\s*[:=]\s*([^,\n#]+)/i);
  if (prefixMatch && prefixMatch[1]) {
    const extracted = prefixMatch[1].trim();
    const match = CANONICAL_RELATIONSHIPS.find(
      (r) => r.toLowerCase() === extracted.toLowerCase()
    );
    return match || extracted;
  }

  // Hashtag hints
  if (/#(?:bridesister|sister|cousin)\b/i.test(lower)) {
    return "Bride's Sister / Cousin";
  }
  if (/#(?:groomsquad|squad|barati|baraati)\b/i.test(lower)) {
    return "Groom's Squad";
  }
  if (/#(?:bridebff|bff|bestfriend)\b/i.test(lower)) {
    return "Bride's Best Friend";
  }
  if (/#(?:family)\b/i.test(lower)) {
    return 'Family';
  }
  if (/#(?:collegefriend|friend)\b/i.test(lower)) {
    return 'College Friend';
  }
  if (/#(?:crew|team|organizer)\b/i.test(lower)) {
    return 'Organizing Team';
  }

  // Keyword patterns with plurals and variations
  if (/\b(?:sisters?|cousins?|bride'?s sister|bride'?s cousin|bridesmaids?)\b/i.test(lower)) {
    return "Bride's Sister / Cousin";
  }
  if (/\b(?:squad|groom'?s squad|groom squad|groomsmen|baratis?|baraatis?|groom'?s friends?)\b/i.test(lower)) {
    return "Groom's Squad";
  }
  if (/\b(?:best friends?|bffs?|bride'?s best friend)\b/i.test(lower)) {
    return "Bride's Best Friend";
  }
  if (/\b(?:family|uncles?|aunts?|chachas?|chachis?|mamas?|mamis?|buas?|fufas?|parents?)\b/i.test(lower)) {
    return 'Family';
  }
  if (/\b(?:college friends?|school friends?|hostel|roommates?)\b/i.test(lower)) {
    return 'College Friend';
  }
  if (/\b(?:organizing team|organizers?|wedding crew|event team|planners?)\b/i.test(lower)) {
    return 'Organizing Team';
  }

  return explicitRelationship && explicitRelationship.trim() ? explicitRelationship.trim() : 'Guest';
}

/**
 * Classify user intent deterministically based on media attachments and caption keywords.
 */
export function detectWhatsAppIntent(
  mediaCount: number,
  caption: string
): WhatsAppIntent {
  if (mediaCount > 0) {
    return 'upload_photos';
  }

  const lower = (caption || '').trim().toLowerCase();

  if (
    /\b(?:link|magic link|magic|login|portal|gallery|album url|website|access)\b/i.test(
      lower
    )
  ) {
    return 'magic_link';
  }

  if (
    /\b(?:status|count|how many|my photos|statistics|stats|uploads)\b/i.test(
      lower
    )
  ) {
    return 'status';
  }

  if (
    /(?:rel|relationship|role)\s*[:=]/i.test(caption) ||
    /^(?:i am|i'm)\s+/i.test(caption)
  ) {
    return 'set_relationship';
  }

  // Greeting or general query
  if (
    !lower ||
    /\b(?:hi|hello|hey|namaste|start|help|info|menu|hola)\b/i.test(lower)
  ) {
    return 'greeting';
  }

  return 'greeting';
}

/**
 * Build 1-tap Magic Login link grounded in supabase/schema.sql:
 * `/?code=AISH2026&phone=...&name=...&rel=...`
 */
export function buildMagicLoginUrl(
  phone: string,
  profileName: string,
  relationship: string,
  originUrl?: string,
  inviteCode: string = DEFAULT_INVITE_CODE
): string {
  const base = (
    originUrl ||
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_APP_URL) ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');

  const params = new URLSearchParams({
    code: inviteCode,
    phone: phone,
    name: profileName,
    rel: relationship,
  });

  return `${base}/?${params.toString()}`;
}

/**
 * Generate conversational WhatsApp Bot reply text receipt.
 * Rich, welcoming wedding tone celebrating Aishwarya & Ashish (#AishHiAish).
 */
export function generateWhatsAppBotReply(args: {
  profileName: string;
  phone: string;
  relationship: string;
  intent: WhatsAppIntent;
  eventName: WeddingEventName;
  mediaCount: number;
  magicLoginUrl: string;
}): string {
  const { profileName, relationship, intent, eventName, mediaCount, magicLoginUrl } =
    args;
  const firstName = profileName.split(' ')[0] || profileName;

  switch (intent) {
    case 'upload_photos': {
      const photoNoun =
        mediaCount === 1
          ? 'photo has'
          : `${mediaCount} photos have`;
      return [
        `✨ *Moments Received!* Thank you so much, ${firstName}!`,
        `Your ${photoNoun} been safely added to the *${eventName}* album for Aishwarya & Ashish's wedding (#AishHiAish). 📸❤️`,
        '',
        `Tagged as: *${relationship}*`,
        '',
        `Tap your personal 1-tap Magic Link to view the live shared album, like moments, and join the wedding chatter:`,
        `👉 ${magicLoginUrl}`,
      ].join('\n');
    }

    case 'magic_link': {
      return [
        `💌 *Your Wedding Gallery Magic Link*`,
        '',
        `Namaste ${firstName}! Here is your direct 1-tap pass to Aishwarya & Ashish's shared wedding album (#AishHiAish):`,
        `👉 ${magicLoginUrl}`,
        '',
        `Verified for *${relationship}* (no password needed). Enjoy the memories! ✨`,
      ].join('\n');
    }

    case 'set_relationship': {
      return [
        `🎉 *Relationship Updated!*`,
        '',
        `You are now registered as *${relationship}* for Aishwarya & Ashish's wedding celebration (#AishHiAish).`,
        '',
        `Send your candid photos anytime with #mehendi, #sangeet, or #wedding in the caption to sort them into albums!`,
        '',
        `Explore the live album:`,
        `👉 ${magicLoginUrl}`,
      ].join('\n');
    }

    case 'status': {
      return [
        `📊 *Wedding Moments Status*`,
        '',
        `Namaste ${firstName}! The #AishHiAish shared wedding album is actively collecting live memories across Mehendi, Sangeet & The Wedding.`,
        '',
        `Open your live album to view candid highlights and friend uploads:`,
        `👉 ${magicLoginUrl}`,
      ].join('\n');
    }

    case 'greeting':
    default: {
      return [
        `🙏 *Namaste ${firstName}! Welcome to #AishHiAish Moments Bot* ✨`,
        '',
        `Celebrating *Aishwarya ♡ Ashish*`,
        '',
        `Send your favorite candid wedding photos directly in this chat! Tag them with hashtags in your caption:`,
        `• *#mehendi* for Mehendi magic`,
        `• *#sangeet* for Sangeet dance moments`,
        `• *#wedding* for The Mandap & Pheras`,
        '',
        `Or tap your 1-tap Magic Link to explore the gallery right now:`,
        `👉 ${magicLoginUrl}`,
      ].join('\n');
    }
  }
}

// =============================================================================
// 8. PRIMARY PURE DETERMINISTIC PARSER: parseWhatsAppWebhook
// =============================================================================

/**
 * Pure, deterministic parser that normalizes:
 * 1. Meta WhatsApp Cloud API (Graph API v21.0) JSON webhook payloads
 * 2. Twilio WhatsApp webhook payloads (form-urlencoded or JSON)
 * 3. In-app interactive WhatsApp Bot Simulator payloads
 *
 * Grounded in:
 * - Hashtag detection: #mehendi, #sangeet, #wedding
 * - Conversational WhatsApp Bot receipt generation
 * - 1-tap Magic Login URL: /?code=AISH2026&phone=...&name=...&rel=...
 */
export function parseWhatsAppWebhook(
  body: unknown,
  originUrl?: string
): NormalizedWhatsAppTurn {
  let phone = '+919876543210';
  let profileName = 'Wedding Guest';
  let relationship = 'Guest';
  let caption = '';
  let preferredEvent: WeddingEventName | undefined;
  const mediaItems: WhatsAppMediaItem[] = [];

  // ---------------------------------------------------------------------------
  // Case A: Meta WhatsApp Cloud API Payload (Graph API v21.0)
  // ---------------------------------------------------------------------------
  if (isMetaWhatsAppWebhookPayload(body)) {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0]?.value;

    const contact = change?.contacts?.[0];
    if (contact?.wa_id) {
      phone = normalizePhoneNumber(contact.wa_id);
    }
    if (contact?.profile?.name) {
      profileName = contact.profile.name.trim();
    }

    const message = change?.messages?.[0];
    if (message) {
      if (message.from && !contact?.wa_id) {
        phone = normalizePhoneNumber(message.from);
      }

      switch (message.type) {
        case 'image': {
          caption = message.image?.caption || '';
          if (message.image?.id) {
            mediaItems.push({
              url: `https://graph.facebook.com/v21.0/${message.image.id}`,
              mimeType: message.image.mime_type || 'image/jpeg',
              fileHash: message.image.sha256,
              filename: `meta-upload-${message.image.id}.jpg`,
            });
          }
          break;
        }
        case 'video': {
          caption = message.video?.caption || '';
          if (message.video?.id) {
            mediaItems.push({
              url: `https://graph.facebook.com/v21.0/${message.video.id}`,
              mimeType: message.video.mime_type || 'video/mp4',
              fileHash: message.video.sha256,
              filename: `meta-video-${message.video.id}.mp4`,
            });
          }
          break;
        }
        case 'document': {
          caption = message.document?.caption || '';
          if (message.document?.id) {
            mediaItems.push({
              url: `https://graph.facebook.com/v21.0/${message.document.id}`,
              mimeType: message.document.mime_type || 'application/octet-stream',
              fileHash: message.document.sha256,
              filename: message.document.filename || `meta-doc-${message.document.id}`,
            });
          }
          break;
        }
        case 'interactive': {
          caption =
            message.interactive?.button_reply?.title ||
            message.interactive?.list_reply?.title ||
            '';
          break;
        }
        case 'text':
        default: {
          caption = message.text?.body || '';
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Case B: Twilio WhatsApp Webhook Payload
  // ---------------------------------------------------------------------------
  else if (isTwilioWhatsAppWebhookPayload(body)) {
    if (body.From) {
      phone = normalizePhoneNumber(body.From);
    } else if (body.WaId) {
      phone = normalizePhoneNumber(body.WaId);
    }

    if (body.ProfileName) {
      profileName = body.ProfileName.trim();
    }

    caption = body.Body || '';

    const numMedia =
      typeof body.NumMedia === 'number'
        ? body.NumMedia
        : parseInt(body.NumMedia || '0', 10);

    const safeNumMedia = Math.min(Math.max(0, isNaN(numMedia) ? 0 : numMedia), 10);

    for (let i = 0; i < safeNumMedia; i++) {
      const urlKey = `MediaUrl${i}` as keyof TwilioWhatsAppWebhookPayload;
      const typeKey = `MediaContentType${i}` as keyof TwilioWhatsAppWebhookPayload;
      const mediaUrl = body[urlKey];
      const mediaType = body[typeKey];

      if (typeof mediaUrl === 'string' && mediaUrl.trim()) {
        mediaItems.push({
          url: mediaUrl.trim(),
          mimeType: typeof mediaType === 'string' ? mediaType : 'image/jpeg',
          filename: `twilio-media-${i}.jpg`,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Case C: Simulated WhatsApp Message Payload (Simulator)
  // ---------------------------------------------------------------------------
  else if (isSimulatedWhatsAppMessagePayload(body)) {
    phone = normalizePhoneNumber(body.phone);
    if (body.profileName) {
      profileName = body.profileName.trim();
    }
    caption = body.body || '';
    if (body.relationship) {
      relationship = body.relationship.trim();
    }
    if (body.eventName && WEDDING_EVENTS.includes(body.eventName)) {
      preferredEvent = body.eventName;
    }
    if (Array.isArray(body.mediaItems)) {
      for (const item of body.mediaItems) {
        if (item && typeof item.url === 'string' && item.url.trim()) {
          mediaItems.push({
            url: item.url.trim(),
            filename: item.filename,
            fileHash: item.fileHash,
            mimeType: item.mimeType || 'image/jpeg',
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Case D: Fallback / Partial object parsing (Safe defense against unknown structures)
  // ---------------------------------------------------------------------------
  else if (body && typeof body === 'object') {
    const p = body as Record<string, unknown>;
    if (typeof p.phone === 'string') phone = normalizePhoneNumber(p.phone);
    if (typeof p.From === 'string') phone = normalizePhoneNumber(p.From);
    if (typeof p.name === 'string') profileName = p.name.trim();
    if (typeof p.profileName === 'string') profileName = p.profileName.trim();
    if (typeof p.relationship === 'string') relationship = p.relationship.trim();
    if (typeof p.body === 'string') caption = p.body;
    if (typeof p.caption === 'string') caption = p.caption;
  }

  // Detect final attributes
  relationship = detectRelationship(caption, relationship);
  const eventName = detectWeddingEvent(caption, preferredEvent);
  const intent = detectWhatsAppIntent(mediaItems.length, caption);
  const magicLoginUrl = buildMagicLoginUrl(
    phone,
    profileName,
    relationship,
    originUrl
  );

  const botReplyText = generateWhatsAppBotReply({
    profileName,
    phone,
    relationship,
    intent,
    eventName,
    mediaCount: mediaItems.length,
    magicLoginUrl,
  });

  return {
    phone,
    profileName,
    relationship,
    intent,
    eventName,
    caption,
    mediaItems,
    botReplyText,
    magicLoginUrl,
  };
}
