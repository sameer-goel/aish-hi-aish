'use client';

import React, { useState } from 'react';
import { Profile, GuestRole } from '@/lib/supabase';

interface GuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: Profile | null;
  onProfileUpdate: (profile: Profile) => void;
}

export const RELATIONSHIP_OPTIONS = [
  "Bride's Brother",
  "Bride's Sister / Cousin",
  "Bride's Family",
  "Groom's Family",
  "Bride's Friend",
  "Groom's Squad",
  "Organizing Team",
  "College Friend",
  "Guest",
];

export default function GuestModal({
  isOpen,
  onClose,
  currentProfile,
  onProfileUpdate,
}: GuestModalProps) {
  const [phone, setPhone] = useState(currentProfile?.phone || '+919876543210');
  const [displayName, setDisplayName] = useState(currentProfile?.display_name || '');
  const [relationship, setRelationship] = useState(currentProfile?.relationship || "Bride's Friend");
  const [role, setRole] = useState<GuestRole>(currentProfile?.role || 'guest');
  const [inviteCode, setInviteCode] = useState(currentProfile?.invite_code || 'AISH2026');
  const [otp, setOtp] = useState('123456');
  const [statusMsg, setStatusMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSendOtp = async () => {
    setIsLoading(true);
    setStatusMsg('');
    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          phone,
          inviteCode,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setOtp(data.sandboxOtp || '123456');
        setStatusMsg('✨ ' + data.message);
      } else {
        setStatusMsg('❌ ' + (data.error || 'Failed to send OTP'));
      }
    } catch (err: any) {
      setStatusMsg('❌ ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setStatusMsg('');
    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          phone,
          otp,
          inviteCode,
          displayName: displayName || (role === 'host' ? 'Wedding Host' : 'Sameer Goel'),
          relationship,
          role,
        }),
      });
      const data = await res.json();
      if (data.ok && data.profile) {
        localStorage.setItem('aish_guest_session', JSON.stringify(data.profile));
        onProfileUpdate(data.profile);
        onClose();
      } else {
        setStatusMsg('❌ ' + (data.error || 'Verification failed'));
      }
    } catch (err: any) {
      setStatusMsg('❌ ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick 1-tap presets for seamless testing
  const setQuickGuest = () => {
    setPhone('+919876543210');
    setDisplayName('Sameer Goel');
    setRelationship("Groom's Squad");
    setRole('guest');
    setInviteCode('AISH2026');
    setOtp('123456');
  };

  const setQuickHost = () => {
    setPhone('+919811122233');
    setDisplayName('Aishwarya & Ashish (Hosts)');
    setRelationship('Host & Organizing Team');
    setRole('host');
    setInviteCode('AISH_HOST_2026');
    setOtp('123456');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-[#ead8e2] text-left animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center transition-colors"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#f5e2ed] text-[#8f4e7c] flex items-center justify-center text-xl font-serif-heading font-bold mb-3 shadow-inner">
            A♡A
          </div>
          <h2 className="text-2xl font-serif-heading font-bold text-[#352b34]">
            {currentProfile ? 'Guest Identity' : 'Welcome to AishHiAish'}
          </h2>
          <p className="text-xs text-[#826e7d] mt-1">
            Access the live wedding moments album & WhatsApp concierge
          </p>
        </div>

        {/* Quick Testing Shortcuts */}
        <div className="mb-5 p-3 rounded-2xl bg-[#fff7fb] border border-[#f5e2ed] flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-[#8f4e7c] uppercase tracking-wider">
            Quick 1-Tap:
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={setQuickGuest}
              className="px-2.5 py-1 text-xs rounded-lg bg-white border border-[#ead8e2] text-[#8f4e7c] hover:bg-[#f5e2ed] font-medium transition-colors"
            >
              Guest Preset
            </button>
            <button
              type="button"
              onClick={setQuickHost}
              className="px-2.5 py-1 text-xs rounded-lg bg-[#8f4e7c] text-white hover:bg-[#723c62] font-medium transition-colors"
            >
              Host / Organizer
            </button>
          </div>
        </div>

        <form onSubmit={handleVerify} className="space-y-4 text-sm">
          {/* Display Name */}
          <div>
            <label className="block text-xs font-semibold text-[#6a425f] uppercase tracking-wider mb-1">
              Your Name
            </label>
            <input
              type="text"
              placeholder="e.g. Sameer Goel or Neha"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#ead8e2] bg-[#fffaf8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8f4e7c] text-[#352b34]"
            />
          </div>

          {/* Relationship Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#6a425f] uppercase tracking-wider mb-1">
              Relationship to Aishwarya & Ashish
            </label>
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#ead8e2] bg-[#fffaf8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8f4e7c] text-[#352b34]"
            >
              {RELATIONSHIP_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Phone & Send OTP */}
          <div>
            <label className="block text-xs font-semibold text-[#6a425f] uppercase tracking-wider mb-1">
              Phone Number (WhatsApp Verified)
            </label>
            <div className="flex gap-2">
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#ead8e2] bg-[#fffaf8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8f4e7c] text-[#352b34]"
              />
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={isLoading}
                className="px-3 py-2 text-xs font-semibold text-[#8f4e7c] bg-[#f5e2ed] hover:bg-[#ebd0e1] rounded-xl transition-colors whitespace-nowrap"
              >
                Send OTP
              </button>
            </div>
          </div>

          {/* Sandbox OTP */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#6a425f] uppercase tracking-wider mb-1">
                OTP (Sandbox: 123456)
              </label>
              <input
                type="text"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#ead8e2] bg-[#fffaf8] font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-[#8f4e7c]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6a425f] uppercase tracking-wider mb-1">
                Invite Code
              </label>
              <input
                type="text"
                placeholder="AISH2026"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#ead8e2] bg-[#fffaf8] font-mono uppercase tracking-wider text-center focus:outline-none focus:ring-2 focus:ring-[#8f4e7c]"
              />
            </div>
          </div>

          {/* Role Pill Switch */}
          <div>
            <label className="block text-xs font-semibold text-[#6a425f] uppercase tracking-wider mb-1.5">
              Access Role
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRole('guest')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all ${
                  role === 'guest' || role === 'family'
                    ? 'bg-[#8f4e7c] text-white border-[#8f4e7c] shadow-sm'
                    : 'bg-white text-[#826e7d] border-[#ead8e2]'
                }`}
              >
                Guest / Family
              </button>
              <button
                type="button"
                onClick={() => {
                  setRole('host');
                  setInviteCode('AISH_HOST_2026');
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all ${
                  role === 'host' || role === 'organizer'
                    ? 'bg-[#8f4e7c] text-white border-[#8f4e7c] shadow-sm'
                    : 'bg-white text-[#826e7d] border-[#ead8e2]'
                }`}
              >
                Host / Organizer 👑
              </button>
            </div>
          </div>

          {statusMsg && (
            <p className="text-xs p-2.5 rounded-xl bg-[#fff7fb] border border-[#f5e2ed] text-[#703b60]">
              {statusMsg}
            </p>
          )}

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-[#8f4e7c] hover:bg-[#723c62] text-white font-semibold text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? 'Verifying...' : currentProfile ? 'Save & Update Profile' : 'Enter Live Wedding Album ✨'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
