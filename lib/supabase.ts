import { createClient } from '@supabase/supabase-js';
import { DEMO_SAMPLES, DemoSample } from './demo-samples';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wxzluylkxkbuesykwnov.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4emx1eWxreGtidWVzeWt3bm92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0MDgxNjUsImV4cCI6MjEwODk4NDE2NX0.rwxUgVejNCQCgziDuojTq8ycYK24z0C-Ytmc2Gfrtw8';

// Browser / Client Component client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// TypeScript Types matching public tables in supabase/schema.sql
export type GuestRole = 'guest' | 'family' | 'organizer' | 'host';
export type EventName = 'Mehendi' | 'Sangeet' | 'Wedding';
export type MediaSource = 'web' | 'whatsapp' | 'seed';

export interface Profile {
  id: string;
  phone: string;
  display_name: string;
  relationship: string;
  role: GuestRole;
  avatar_color: string;
  invite_code: string;
  created_at: string;
}

export interface UploadBatch {
  id: string;
  uploader_id: string;
  event_name: EventName;
  caption: string;
  source: MediaSource;
  photo_count: number;
  created_at: string;
  // Joined relation fields:
  uploader?: Profile;
  photos?: Photo[];
}

export interface Photo {
  id: string;
  batch_id?: string;
  uploader_id: string;
  storage_path: string;
  public_url: string;
  original_filename: string;
  file_hash: string;
  file_size: number;
  width: number;
  height: number;
  event_name: EventName;
  caption: string;
  source: MediaSource;
  likes_count: number;
  is_hidden: boolean;
  created_at: string;
  // Joined relation fields:
  uploader?: Profile;
  comments?: Comment[];
}

export interface Comment {
  id: string;
  photo_id?: string;
  batch_id?: string;
  author_id: string;
  author_name: string;
  author_relationship: string;
  body: string;
  created_at: string;
}

export interface Reaction {
  id: string;
  photo_id: string;
  profile_id: string;
  created_at: string;
}

// -----------------------------------------------------------------------------
// Client-Side Crypto & Image Helpers
// -----------------------------------------------------------------------------

/**
 * Compute SHA-256 hexadecimal hash using Web Crypto API
 */
export async function computeFileSha256(file: File | Blob | ArrayBuffer): Promise<string> {
  const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Strip EXIF/GPS metadata and compress image to crisp JPEG using HTML5 <canvas>.
 * Because HTML5 Canvas draws raw decoded pixel bitmaps, all EXIF/GPS chunks are scrubbed.
 */
export async function stripExifAndCompressImage(
  file: File | Blob,
  maxDim = 2048,
  quality = 0.88
): Promise<{ blob: Blob; width: number; height: number; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for canvas scrubbing'));
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Scale down proportionally if larger than maxDim
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }

        // Crisp image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas toBlob compression failed'));
              return;
            }
            resolve({ blob, width, height, dataUrl });
          },
          'image/jpeg',
          quality
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// -----------------------------------------------------------------------------
// Fallback Resilience & Demo Seeds
// -----------------------------------------------------------------------------

/**
 * Converts DEMO_SAMPLES into Photo[] models with simulated uploader profiles
 */
export function getDemoFallbackPhotos(): Photo[] {
  const avatarColors = ['#8f4e7c', '#a85888', '#b86b96', '#69385b', '#4a2540', '#d884a4'];
  return DEMO_SAMPLES.map((sample, idx) => {
    const profileId = `demo-profile-${sample.id}`;
    const photoId = `demo-photo-${sample.id}`;
    const batchId = `demo-batch-${sample.id}`;
    const color = avatarColors[idx % avatarColors.length];

    const uploader: Profile = {
      id: profileId,
      phone: `+91987650000${sample.id}`,
      display_name: sample.guest,
      relationship: sample.relationship,
      role: sample.relationship.includes('Organizing') ? 'organizer' : 'guest',
      avatar_color: color,
      invite_code: 'AISH2026',
      created_at: '2026-10-31T08:00:00.000Z',
    };

    const comments: Comment[] = sample.comments.map((c, cIdx) => ({
      id: `demo-comment-${sample.id}-${cIdx}`,
      photo_id: photoId,
      batch_id: batchId,
      author_id: `demo-author-${cIdx}`,
      author_name: c.who,
      author_relationship: 'Family',
      body: c.text,
      created_at: '2026-10-31T08:00:00.000Z',
    }));

    return {
      id: photoId,
      batch_id: batchId,
      uploader_id: profileId,
      storage_path: `demo/sample-${sample.id}.jpg`,
      public_url: sample.url,
      original_filename: `moment-${sample.id}.jpg`,
      file_hash: sample.sha256,
      file_size: 450000,
      width: 1200,
      height: 900,
      event_name: (sample.event as EventName) || 'Wedding',
      caption: sample.caption,
      source: 'seed',
      likes_count: sample.likes || (sample.id === 2 ? 8 : sample.id === 3 ? 12 : 5),
      is_hidden: false,
      created_at: '2026-10-31T08:00:00.000Z',
      uploader,
      comments,
    };
  });
}

/**
 * Normalizes phone numbers to standard E.164-like format (e.g., +919876543210)
 */
export function normalizePhoneNumber(raw: string): string {
  let cleaned = (raw || '').trim().replace(/[^\d+]/g, '');
  if (!cleaned) return '+919876543210';
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) {
      cleaned = '+91' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }
  return cleaned;
}

/**
 * Pick an avatar berry/rose color from phone/name
 */
export function generateAvatarColor(seed: string): string {
  const palette = [
    '#8f4e7c', // royal berry
    '#a4568b', // warm berry
    '#b76899', // rose berry
    '#753d64', // deep ink berry
    '#9d5483', // magenta berry
    '#683257', // vintage velvet
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % palette.length;
  return palette[idx];
}
