<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AishHiAish Wedding Moments — Project & Agent Harness Constitution

## 1. Mandatory Operating & Autonomy Rules
- **Project Location:** Always work inside `/Users/440k/projects/aish-hi-aish` (all projects live under `/Users/440k/projects/`). Since no Delta worktree is attached, use `terminal` (`cd /Users/440k/projects/aish-hi-aish && ...`) for file reads, writes, builds, and tests.
- **Autonomous Browser Actions (`aside`):** Never ask the user to manually click, sign in, create repos, or run SQL in a browser. Always use `aside` autonomously. Only ask the user when a personal email choice is needed for a new signup or when a private 2FA/email code is sent to their personal device.
- **Non-Interactive CLI Execution:** Always pass `--yes`, `CI=true`, `GIT_EDITOR=true` to terminal commands so no command hangs waiting for interactive input.
- **ETR & Visual Status Dashboard:** Every agent update to the user MUST include a structured visual table at the top showing:
  - Active Harness Mode & Agent Roster ("Who Is Working On What")
  - **Estimated Time Remaining (ETR)** in minutes for each active/upcoming task
  - Progress percentage and any blockers.
- **Anti-Hallucination & Reference Verification (`Satya` / `reference`):** Never guess Next.js 16, React 19, Supabase v2, Uppy v6, or WhatsApp Webhook APIs. Always verify against:
  1. Existing reference code (`demo_repo/aishhiaish-demo/index.html` and GitHub references)
  2. Installed TypeScript definitions in `node_modules/` and Next.js 16 docs in `node_modules/next/dist/docs/`
  3. `npx tsc --noEmit` and `npm run build` before marking any feature complete.

## 2. Meta-Grade Product & UX Standards
- **Brand Aesthetic:** Preserve the warm AishHiAish wedding palette (`--cream: #fffaf8`, `--pink: #f5e2ed`, `--berry: #8f4e7c`, `--ink: #352b34`, `--muted: #826e7d`, `--line: #ead8e2`, Georgia serif headings + clean sans-serif UI) combined with Meta/Instagram-level mobile polish.
- **Dual Ingestion Channels:**
  1. **WhatsApp Bot Upload (`/api/whatsapp/webhook` + In-App WhatsApp Simulator & Connect Card):** Guests can send photos directly on WhatsApp (where their phone number `WaId` and `ProfileName` are pre-verified by WhatsApp and uploads continue natively in the background even when their screen locks).
  2. **Mobile Web Multi-Photo Upload:** Full-resolution camera-roll batch selection with SHA-256 duplicate detection (`file_hash`), client-side GPS/EXIF stripping, per-file progress bars, and batch captions.
- **Dual Browsing Views:**
  1. **Live Timeline View (Instagram/Facebook Feed):** Batch uploads appear as a unified social post card with guest avatar, display name, relationship pill (e.g. *Bride's Brother*, *Groom's Side*), event badge (`Mehendi`, `Sangeet`, `Wedding`), swipeable multi-photo carousel, heart reactions, and live comments.
  2. **Photo Gallery View (Masonry/Grid Album):** High-density grid filterable by `All`, `Mehendi`, `Sangeet`, `Wedding`, and `My Uploads`, with full-screen lightbox, high-res download, and host moderation.
- **Guest Access & OTP:** Invite-protected guest session with Phone/WhatsApp OTP verification (including one-tap Sandbox/Test OTP `123456` so testing never blocks on SMS delivery) + Relationship & Role (`guest`, `family`, `organizer`, `host`) capture.
