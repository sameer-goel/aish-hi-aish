'use client';

import React from 'react';
import { Photo } from '@/lib/supabase';

export type StoryFilter = 'All' | 'Mehendi' | 'Sangeet' | 'Wedding' | 'MyUploads' | 'WhatsApp';

interface StoryRingsProps {
  activeFilter: StoryFilter;
  onSelectFilter: (filter: StoryFilter) => void;
  photos: Photo[];
  currentPhone?: string;
}

export default function StoryRings({
  activeFilter,
  onSelectFilter,
  photos,
  currentPhone,
}: StoryRingsProps) {
  // Compute counts
  const allCount = photos.filter((p) => !p.is_hidden).length;
  const mehendiCount = photos.filter((p) => !p.is_hidden && p.event_name === 'Mehendi').length;
  const sangeetCount = photos.filter((p) => !p.is_hidden && p.event_name === 'Sangeet').length;
  const weddingCount = photos.filter((p) => !p.is_hidden && p.event_name === 'Wedding').length;
  const whatsAppCount = photos.filter((p) => !p.is_hidden && p.source === 'whatsapp').length;
  const myCount = photos.filter(
    (p) => !p.is_hidden && currentPhone && p.uploader?.phone === currentPhone
  ).length;

  const rings: Array<{
    id: StoryFilter;
    label: string;
    icon: string;
    count: number;
    sublabel: string;
    bgGradient: string;
  }> = [
    {
      id: 'All',
      label: 'All Moments',
      icon: '✨',
      count: allCount,
      sublabel: 'Full Story',
      bgGradient: 'from-[#d4a373] via-[#8f4e7c] to-[#f5e2ed]',
    },
    {
      id: 'Mehendi',
      label: 'Mehendi',
      icon: '🌿',
      count: mehendiCount,
      sublabel: 'Henna & Song',
      bgGradient: 'from-[#4d7c0f] via-[#84cc16] to-[#ecfccb]',
    },
    {
      id: 'Sangeet',
      label: 'Sangeet',
      icon: '💃',
      count: sangeetCount,
      sublabel: 'Dance & Beats',
      bgGradient: 'from-[#be185d] via-[#8f4e7c] to-[#fbcfe8]',
    },
    {
      id: 'Wedding',
      label: 'The Wedding',
      icon: '👑',
      count: weddingCount,
      sublabel: 'Mandap & Vows',
      bgGradient: 'from-[#d97706] via-[#b45309] to-[#fef3c7]',
    },
    {
      id: 'MyUploads',
      label: 'My Uploads',
      icon: '📸',
      count: myCount,
      sublabel: 'Your Photos',
      bgGradient: 'from-[#0284c7] via-[#8f4e7c] to-[#e0f2fe]',
    },
    {
      id: 'WhatsApp',
      label: 'WhatsApp Drops',
      icon: '💬',
      count: whatsAppCount,
      sublabel: 'Bot Drops',
      bgGradient: 'from-[#10b981] via-[#059669] to-[#d1fae5]',
    },
  ];

  return (
    <div className="w-full overflow-x-auto no-scrollbar py-3 px-2">
      <div className="flex items-center gap-4 sm:gap-6 min-w-max mx-auto justify-start sm:justify-center px-2">
        {rings.map((ring) => {
          const isActive = activeFilter === ring.id;
          return (
            <button
              key={ring.id}
              onClick={() => onSelectFilter(ring.id)}
              className="group flex flex-col items-center focus:outline-none transition-transform active:scale-95"
            >
              {/* Outer Gradient Ring */}
              <div
                className={`p-[2.5px] rounded-full transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-tr from-[#d4a373] via-[#8f4e7c] to-[#e28cb9] shadow-lg scale-105'
                    : 'bg-[#ead8e2] hover:bg-gradient-to-tr hover:from-[#d4a373] hover:to-[#8f4e7c]'
                }`}
              >
                {/* Inner White Gap */}
                <div className="p-[2.5px] bg-white rounded-full">
                  {/* Story Circle Avatar */}
                  <div
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex flex-col items-center justify-center text-xl sm:text-2xl shadow-inner transition-colors ${
                      isActive ? 'bg-[#f8e7ee]' : 'bg-[#fffaf8] group-hover:bg-[#fcf1f6]'
                    }`}
                  >
                    <span>{ring.icon}</span>
                  </div>
                </div>
              </div>

              {/* Ring Label & Count Pill */}
              <div className="mt-1.5 flex flex-col items-center">
                <span
                  className={`text-xs font-semibold tracking-tight transition-colors ${
                    isActive ? 'text-[#8f4e7c] font-bold' : 'text-[#352b34] group-hover:text-[#8f4e7c]'
                  }`}
                >
                  {ring.label}
                </span>
                <span className="text-[10px] text-[#826e7d] flex items-center gap-0.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#8f4e7c]/40"></span>
                  {ring.count} {ring.count === 1 ? 'pic' : 'pics'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
