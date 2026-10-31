'use client';

import React from 'react';
import { Photo, Profile } from '@/lib/supabase';

interface HostBarProps {
  currentUser: Profile | null;
  photos: Photo[];
  showHidden: boolean;
  onToggleShowHidden: () => void;
}

export default function HostBar({
  currentUser,
  photos,
  showHidden,
  onToggleShowHidden,
}: HostBarProps) {
  const isHost = currentUser?.role === 'host' || currentUser?.role === 'organizer';
  if (!isHost) return null;

  const totalPhotos = photos.length;
  const hiddenCount = photos.filter((p) => p.is_hidden).length;

  // Export JSON Manifest
  const handleExportJSON = () => {
    const manifest = {
      event: 'Aishwarya & Ashish Wedding Moments',
      exportedAt: new Date().toISOString(),
      totalMoments: photos.length,
      photos: photos.map((p) => ({
        id: p.id,
        uploader: p.uploader?.display_name || 'Guest',
        relationship: p.uploader?.relationship || 'Guest',
        phone: p.uploader?.phone || '',
        event: p.event_name,
        caption: p.caption,
        source: p.source,
        likes: p.likes_count,
        isHidden: p.is_hidden,
        publicUrl: p.public_url,
        fileHash: p.file_hash,
        createdAt: p.created_at,
        commentsCount: p.comments?.length || 0,
      })),
    };

    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AishHiAish-Wedding-Manifest-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export CSV Manifest
  const handleExportCSV = () => {
    const headers = ['ID', 'Uploader', 'Relationship', 'Phone', 'Event', 'Caption', 'Source', 'Likes', 'Hidden', 'Created At', 'Photo URL'];
    const rows = photos.map((p) => [
      p.id,
      `"${(p.uploader?.display_name || 'Guest').replace(/"/g, '""')}"`,
      `"${(p.uploader?.relationship || 'Guest').replace(/"/g, '""')}"`,
      `"${p.uploader?.phone || ''}"`,
      p.event_name,
      `"${(p.caption || '').replace(/"/g, '""')}"`,
      p.source,
      p.likes_count,
      p.is_hidden ? 'Yes' : 'No',
      p.created_at,
      p.public_url,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AishHiAish-Wedding-Manifest-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download all photos sequentially
  const handleDownloadAll = async () => {
    alert(`Initiating download for ${photos.length} wedding moments. Each photo will open/download.`);
    photos.forEach((p, idx) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = p.public_url;
        a.download = `AishHiAish-${p.event_name}-${idx + 1}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, idx * 300);
    });
  };

  return (
    <div className="w-full bg-[#fbf4f8] border-b border-[#ead8e2] px-4 py-3 text-xs">
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Host Identity Badge */}
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-[#8f4e7c] text-white flex items-center justify-center font-bold text-xs shadow-xs">
            👑
          </span>
          <div>
            <span className="font-bold text-[#6e355c] mr-2">Host & Organizer Dashboard:</span>
            <span className="text-[#826e7d]">
              {totalPhotos} moments ({hiddenCount} moderated/hidden)
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onToggleShowHidden}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
              showHidden
                ? 'bg-[#8f4e7c] text-white border-[#8f4e7c]'
                : 'bg-white text-[#826e7d] border-[#ead8e2] hover:bg-[#f8e7ee]'
            }`}
          >
            {showHidden ? '👁️ Showing All (Inc. Hidden)' : '🚫 View Hidden Only'}
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl bg-white border border-[#ead8e2] text-[#8f4e7c] hover:bg-[#f8e7ee] font-semibold transition-colors flex items-center gap-1"
          >
            📊 Export CSV
          </button>

          <button
            onClick={handleExportJSON}
            className="px-3 py-1.5 rounded-xl bg-white border border-[#ead8e2] text-[#8f4e7c] hover:bg-[#f8e7ee] font-semibold transition-colors flex items-center gap-1"
          >
            📄 Export JSON
          </button>

          <button
            onClick={handleDownloadAll}
            className="px-3 py-1.5 rounded-xl bg-[#8f4e7c] text-white hover:bg-[#723c62] font-semibold transition-colors flex items-center gap-1 shadow-xs"
          >
            📥 Download All Photos
          </button>
        </div>
      </div>
    </div>
  );
}
