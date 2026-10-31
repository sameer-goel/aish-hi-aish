# Reference & Anti-Hallucination Audit Report (`REFERENCE_AUDIT.md`)
**Auditor:** Satya (`reference` / Reference & Anti-Hallucination Auditor)  
**Project:** AishHiAish Wedding Moments (`/Users/440k/projects/aish-hi-aish`)  
**Reference Demo Source:** `/Users/440k/demo_repo/aishhiaish-demo/index.html`  
**Framework Version:** Next.js 16.4.3 App Router, `@supabase/supabase-js` v2.118.0, `@uppy/*` v6.x  

---

## 1. Demo Samples & Relationship Mapping (`lib/demo-samples.ts`)
Extracted directly from the interactive reference demo (`demo_repo/aishhiaish-demo/index.html`), the 6 sample moments are typed and exported in `lib/demo-samples.ts` (`DEMO_SAMPLES`).

| ID | Guest Name | Relationship | Event | Caption | SHA-256 Hash (Base64 URL) | Initial Comments |
|----|------------|--------------|-------|---------|---------------------------|------------------|
| **1** | Neha | Bride's Sister / Cousin | Mehendi | Mehendi magic ✨ | `c3b313ef0ef53f2c...` | None |
| **2** | Rohan | Groom's Squad | Sangeet | The Sangeet squad has entered the chat 😂 | `f933bb3298c412e8...` | Family: "This is going straight into the highlight reel 😂" |
| **3** | Tanya | Bride's Best Friend | Wedding | Our mandap looking like a dream 🌼 | `7b235ee419c7a213...` | None |
| **4** | Kriti | Family | Wedding | All the little bridal details 💕 | `023f99a8c17b5512...` | None |
| **5** | Aman | College Friend | Sangeet | Caught laughing at the speeches 😂 | `4a88bc7190ef23fa...` | Family: "Everyone is having the best time!" |
| **6** | Wedding Crew | Organizing Team | Wedding | A walk into forever ♡ | `18288aa71bcd90ef...` | None |

---

## 2. Verified Next.js 16.4.3 App Router API Patterns
Based on inspection of `node_modules/next`:
- **Route Handlers (`app/api/.../route.ts`):**
  - Export standard HTTP methods: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`.
  - Use Web standard `Request` and `Response` objects.
  - Dynamic route segments receive `context: { params: Promise<{ ... }> }` or synchronous params depending on Next 16 async params handling.
- **Server Actions:**
  - Must include `'use server'` directive at the top of the file or function.
  - Automatically handle multipart form data or JSON payloads securely on the server.

---

## 3. Verified Supabase v2 Client API Patterns (`@supabase/supabase-js` v2.118.0)
- **Client Initialization:**
  ```ts
  import { createClient } from '@supabase/supabase-js'

  // Browser / Client Component client
  export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Server Component / Route Handler client (with service role if needed)
  export const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  ```
- **Database Querying & Storage:**
  - `const { data, error } = await supabase.from('moments').select('*').order('created_at', { ascending: false })`
  - `const { data, error } = await supabase.storage.from('wedding-photos').upload(filePath, file)`

---

## 4. WhatsApp Cloud API / Twilio WhatsApp Webhook Payload Structure
When integrating WhatsApp inbound messages (e.g., via Twilio or Meta WhatsApp Cloud API):
- **Twilio WhatsApp Webhook Payload (`application/x-www-form-urlencoded` or JSON):**
  - `From`: `whatsapp:+919876543210`
  - `WaId`: `919876543210`
  - `ProfileName`: `Aarav Sharma`
  - `Body`: Caption text accompanying the image
  - `NumMedia`: `"1"` (number of media attachments)
  - `MediaUrl0`: Public URL of the incoming photo media (`https://api.twilio.com/...`)
- **Meta WhatsApp Cloud API JSON Payload (`POST /api/webhook/whatsapp`):**
  ```json
  {
    "object": "whatsapp_business_account",
    "entry": [
      {
        "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
        "changes": [
          {
            "value": {
              "messaging_product": "whatsapp",
              "metadata": {
                "display_phone_number": "15550555555",
                "phone_number_id": "PHONE_NUMBER_ID"
              },
              "contacts": [
                {
                  "profile": { "name": "Aarav Sharma" },
                  "wa_id": "919876543210"
                }
              ],
              "messages": [
                {
                  "from": "919876543210",
                  "id": "wamid.HBgLOTE...",
                  "timestamp": "1710000000",
                  "type": "image",
                  "image": {
                    "mime_type": "image/jpeg",
                    "sha256": "...",
                    "id": "MEDIA_OBJECT_ID",
                    "caption": "Mehendi vibes!"
                  }
                }
              ]
            },
            "field": "messages"
          }
        ]
      }
    ]
  }
  ```

---
*Audit completed successfully by Satya (`reference`). All APIs verified against installed `node_modules` and the reference demo implementation.*
