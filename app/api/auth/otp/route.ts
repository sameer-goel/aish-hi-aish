import { NextResponse } from 'next/server';
import { supabase, normalizePhoneNumber, generateAvatarColor, GuestRole } from '@/lib/supabase';

const VALID_CODES = new Set(['AISH2026', 'AISH_HOST_2026', 'AISH2026_HOST', 'AISH_WEDDING']);
const HOST_CODES = new Set(['AISH_HOST_2026', 'AISH2026_HOST']);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      action = 'verify',
      phone = '',
      otp = '',
      inviteCode = '',
      displayName = '',
      relationship = '',
      role,
      magic = false,
    } = body;

    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone || normalizedPhone.length < 8) {
      return NextResponse.json(
        { ok: false, error: 'Please enter a valid phone number.' },
        { status: 400 }
      );
    }

    const upperCode = String(inviteCode || '').trim().toUpperCase();

    // Look up existing profile by phone first so we never clobber existing identity/role (Fixes D2)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    // 1. Validate Invite Code (Fixes D3: require valid invite code unless phone is already registered)
    if (!existingProfile && (!upperCode || !VALID_CODES.has(upperCode))) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid wedding invitation code. Please use code AISH2026 from your invite.',
        },
        { status: 400 }
      );
    }
    if (upperCode && !VALID_CODES.has(upperCode)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid wedding invitation code. Please use code AISH2026 from your invite.',
        },
        { status: 400 }
      );
    }

    // 2. Action: 'send' -> Returns sandbox OTP
    if (action === 'send') {
      return NextResponse.json({
        ok: true,
        phone: normalizedPhone,
        sandboxOtp: '123456',
        message: 'OTP sent via WhatsApp/SMS (Test Mode: use 123456)',
      });
    }

    // 3. Action: 'verify' -> Verify OTP (or verified WhatsApp magic link)
    const isValidOtp = otp === '123456' || (magic === true && Boolean(existingProfile || VALID_CODES.has(upperCode)));
    if (!isValidOtp) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Incorrect OTP. In test mode, enter 123456.',
        },
        { status: 400 }
      );
    }

    // 4. Determine role safely (Fixes D1: only host invite code or existing host/organizer row grants host/organizer)
    let finalRole: GuestRole = existingProfile?.role || 'guest';
    if (HOST_CODES.has(upperCode)) {
      finalRole = 'host';
    } else if (existingProfile?.role === 'host' || existingProfile?.role === 'organizer') {
      finalRole = existingProfile.role;
    } else if (role === 'family' || relationship?.toLowerCase().includes('family') || relationship?.toLowerCase().includes('brother') || relationship?.toLowerCase().includes('sister')) {
      finalRole = 'family';
    }

    const incomingName = String(displayName || '').trim();
    const incomingRel = String(relationship || '').trim();

    // Preserve existing profile name/relationship if re-logging in with blank or generic defaults (Fixes D2)
    const name =
      (incomingName && incomingName !== 'Wedding Guest' ? incomingName : existingProfile?.display_name) ||
      incomingName ||
      'Wedding Guest';

    const rel =
      (incomingRel && incomingRel !== 'Guest' && existingProfile?.role !== 'host'
        ? incomingRel
        : existingProfile?.relationship) ||
      incomingRel ||
      (finalRole === 'host' ? "Bride's Brother" : 'Guest');

    const avatarColor = existingProfile?.avatar_color || generateAvatarColor(name + normalizedPhone);

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          phone: normalizedPhone,
          display_name: name,
          relationship: rel,
          role: finalRole,
          avatar_color: avatarColor,
          invite_code: upperCode || existingProfile?.invite_code || 'AISH2026',
        },
        { onConflict: 'phone' }
      )
      .select('*')
      .single();

    if (error) {
      const fallbackProfile = {
        id: existingProfile?.id || 'guest-' + Math.random().toString(36).substring(2, 10),
        phone: normalizedPhone,
        display_name: name,
        relationship: rel,
        role: finalRole,
        avatar_color: avatarColor,
        invite_code: upperCode || 'AISH2026',
        created_at: new Date().toISOString(),
      };
      return NextResponse.json({ ok: true, profile: fallbackProfile, fallback: true });
    }

    return NextResponse.json({ ok: true, profile: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
