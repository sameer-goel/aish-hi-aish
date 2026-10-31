'use client';

import React, { useState } from 'react';
import { Photo, Profile } from '@/lib/supabase';

interface GalleryLightboxProps {
  photo: Photo | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  currentUser: Profile | null;
  onLikePhoto: (photoId: string) => void;
  onAddComment: (photoId: string, comment: string) => void;
}

export default function GalleryLightbox({
  photo,
  onClose,
  onPrev,
  onNext,
  currentUser,
  onLikePhoto,
  onAddComment,
}: GalleryLightboxProps) {
  const [commentText, setCommentText] = useState('');

  if (!photo) return null;

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(photo.id, commentText.trim());
    setCommentText('');
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = photo.public_url;
    link.download = `AishHiAish-${photo.event_name}-${photo.id.slice(0, 8)}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] rounded-3xl bg-white shadow-2xl border border-[#ead8e2] overflow-hidden grid grid-cols-1 md:grid-cols-[1.3fr_0.9fr] animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-white/90 text-[#352b34] hover:bg-white flex items-center justify-center text-sm shadow-md transition-transform hover:scale-105"
        >
          ✕
        </button>

        {/* Prev / Next Arrows */}
        {onPrev && (
          <button
            onClick={onPrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-[#352b34] flex items-center justify-center text-xl shadow-lg transition-transform hover:scale-110"
          >
            ‹
          </button>
        )}
        {onNext && (
          <button
            onClick={onNext}
            className="absolute right-3 md:right-[calc(37%+12px)] top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-[#352b34] flex items-center justify-center text-xl shadow-lg transition-transform hover:scale-110"
          >
            ›
          </button>
        )}

        {/* Image Display */}
        <div className="relative bg-[#20151d] flex items-center justify-center min-h-[300px] md:min-h-[500px] max-h-[75vh]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.public_url}
            alt={photo.caption || 'Wedding moment'}
            className="max-h-full max-w-full object-contain"
          />
        </div>

        {/* Sidebar Info & Comments */}
        <div className="flex flex-col justify-between p-5 sm:p-6 bg-[#fffaf8] overflow-y-auto max-h-[60vh] md:max-h-[75vh]">
          <div>
            {/* Attribution */}
            <div className="flex items-center gap-3 pb-4 border-b border-[#ead8e2]">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-base shadow-sm"
                style={{ backgroundColor: photo.uploader?.avatar_color || '#8f4e7c' }}
              >
                {photo.uploader?.display_name?.charAt(0).toUpperCase() || 'G'}
              </div>
              <div>
                <h3 className="font-semibold text-sm text-[#352b34]">
                  {photo.uploader?.display_name || 'Wedding Guest'}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#f8e7ee] text-[#8f4e7c] border border-[#edd1e1] font-medium">
                    {photo.uploader?.relationship || 'Guest'}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#fff0f7] text-[#8f4e7c] border border-[#f1dce5] font-medium">
                    {photo.event_name}
                  </span>
                </div>
              </div>
            </div>

            {/* Caption */}
            {photo.caption && (
              <p className="py-4 text-sm text-[#352b34] leading-relaxed border-b border-[#ead8e2]">
                {photo.caption}
              </p>
            )}

            {/* Actions Bar */}
            <div className="flex items-center justify-between py-3 border-b border-[#ead8e2]">
              <button
                type="button"
                onClick={() => onLikePhoto(photo.id)}
                className="flex items-center gap-1.5 text-sm font-semibold text-[#8f4e7c] hover:opacity-80 transition-opacity"
              >
                <span className="text-xl">♥</span>
                <span>{photo.likes_count || 0} Likes</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-white border border-[#ead8e2] text-[#8f4e7c] hover:bg-[#f8e7ee] transition-colors"
              >
                <span>📥 Download High-Res</span>
              </button>
            </div>

            {/* Comments List */}
            <div className="pt-3 space-y-2">
              <span className="text-xs font-semibold text-[#826e7d] uppercase tracking-wider block mb-1">
                Wishes & Comments ({photo.comments?.length || 0})
              </span>
              {(photo.comments || []).length === 0 ? (
                <p className="text-xs text-[#826e7d] italic py-2">
                  Be the first to leave a wedding wish! ♡
                </p>
              ) : (
                photo.comments?.map((c) => (
                  <div key={c.id} className="text-xs p-2.5 rounded-xl bg-white border border-[#f5e2ed]">
                    <span className="font-semibold text-[#8f4e7c] mr-1.5">
                      {c.author_name}:
                    </span>
                    <span className="text-[#352b34]">{c.body}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Add Comment Form */}
          <form onSubmit={handleCommentSubmit} className="pt-4 mt-4 border-t border-[#ead8e2] flex gap-2">
            <input
              type="text"
              placeholder="Leave a wish or comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 px-3 py-2 text-xs rounded-xl border border-[#ead8e2] bg-white focus:outline-none focus:ring-1 focus:ring-[#8f4e7c]"
            />
            <button
              type="submit"
              disabled={!commentText.trim()}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-[#8f4e7c] text-white hover:bg-[#723c62] disabled:opacity-40 transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
