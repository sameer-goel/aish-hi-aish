'use client';

import React, { useState, useRef } from 'react';
import { Photo, Profile, Comment } from '@/lib/supabase';

interface TimelineCardProps {
  post: {
    id: string;
    batchId?: string;
    uploader: Profile;
    photos: Photo[];
    eventName: string;
    caption: string;
    source: string;
    createdAt: string;
  };
  currentUser: Profile | null;
  onLikePhoto: (photoId: string) => void;
  onAddComment: (photoId: string, comment: string) => void;
  onToggleHidePhoto: (photoId: string) => void;
}

export default function TimelineCard({
  post,
  currentUser,
  onLikePhoto,
  onAddComment,
  onToggleHidePhoto,
}: TimelineCardProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showAllComments, setShowAllComments] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const lastTapRef = useRef<number>(0);

  const activePhoto = post.photos[currentSlide] || post.photos[0];
  const totalSlides = post.photos.length;

  // Double-tap on mobile or double-click to burst heart and like
  const handlePhotoDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Trigger double tap like
      setShowHeartBurst(true);
      onLikePhoto(activePhoto.id);
      setTimeout(() => setShowHeartBurst(false), 900);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const handleManualHeartClick = () => {
    setShowHeartBurst(true);
    onLikePhoto(activePhoto.id);
    setTimeout(() => setShowHeartBurst(false), 900);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(activePhoto.id, commentText.trim());
    setCommentText('');
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = activePhoto.public_url;
    link.download = `AishHiAish-${activePhoto.event_name}-${activePhoto.id.slice(0, 8)}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format relative timestamp
  const formatTimeAgo = (dateStr: string) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Event color badge styling
  const getEventBadgeClass = (event: string) => {
    switch (event) {
      case 'Mehendi':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Sangeet':
        return 'bg-pink-50 text-pink-800 border-pink-200';
      default:
        return 'bg-amber-50 text-amber-800 border-amber-200';
    }
  };

  const isHost = currentUser?.role === 'host' || currentUser?.role === 'organizer';
  const allComments: Comment[] = activePhoto.comments || [];
  const visibleComments = showAllComments ? allComments : allComments.slice(-2);

  return (
    <article className="w-full max-w-xl mx-auto rounded-3xl bg-white border border-[#ead8e2] shadow-sm hover:shadow-md transition-shadow overflow-hidden mb-8">
      {/* 1. Card Header */}
      <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#f5e2ed]/60">
        <div className="flex items-center gap-3">
          {/* Monogram Avatar */}
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white text-base shadow-sm ring-2 ring-[#fffaf8]"
            style={{ backgroundColor: post.uploader.avatar_color || '#8f4e7c' }}
          >
            {post.uploader.display_name.charAt(0).toUpperCase()}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-[#352b34] hover:text-[#8f4e7c] transition-colors">
                {post.uploader.display_name}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#f8e7ee] text-[#8f4e7c] border border-[#edd1e1] font-medium">
                {post.uploader.relationship}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-0.5 text-xs text-[#826e7d]">
              {/* Source Badge */}
              {post.source === 'whatsapp' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <span>💬</span> via WhatsApp Bot
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#8f4e7c] bg-[#fff0f7] px-2 py-0.5 rounded-md border border-[#f1dce5]">
                  <span>📸</span> Web Upload
                </span>
              )}

              <span>•</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${getEventBadgeClass(post.eventName)}`}>
                {post.eventName}
              </span>

              <span>•</span>
              <span className="text-[11px]">{formatTimeAgo(post.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Host Moderate Button */}
        {isHost && (
          <button
            onClick={() => onToggleHidePhoto(activePhoto.id)}
            title={activePhoto.is_hidden ? 'Restore photo' : 'Hide from guests'}
            className="p-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-500 transition-colors"
          >
            {activePhoto.is_hidden ? '👁️ Restore' : '🚫 Moderate'}
          </button>
        )}
      </div>

      {/* 2. Photo Carousel with Double-Tap Heart Burst */}
      <div
        className="relative w-full aspect-[4/3] sm:aspect-[4/3] bg-[#f5e2ed]/40 select-none overflow-hidden cursor-pointer"
        onClick={handlePhotoDoubleTap}
      >
        {/* Current Photo Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activePhoto.public_url}
          alt={activePhoto.caption || 'Wedding moment'}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            activePhoto.is_hidden ? 'opacity-40 filter grayscale' : 'opacity-100'
          }`}
          loading="lazy"
        />

        {activePhoto.is_hidden && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white font-semibold text-sm">
            Hidden by Host Moderation
          </div>
        )}

        {/* 1/N Multi-Photo Pill Badge */}
        {totalSlides > 1 && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-semibold tracking-wider">
            {currentSlide + 1}/{totalSlides}
          </div>
        )}

        {/* Carousel Navigation Arrows */}
        {totalSlides > 1 && (
          <>
            {currentSlide > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentSlide((prev) => prev - 1);
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white text-[#352b34] flex items-center justify-center shadow-md text-lg transition-transform hover:scale-105 active:scale-95"
              >
                ‹
              </button>
            )}
            {currentSlide < totalSlides - 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentSlide((prev) => prev + 1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white text-[#352b34] flex items-center justify-center shadow-md text-lg transition-transform hover:scale-105 active:scale-95"
              >
                ›
              </button>
            )}
          </>
        )}

        {/* Floating Heart Burst on Double-Tap */}
        {showHeartBurst && (
          <div className="absolute top-1/2 left-1/2 pointer-events-none z-20 animate-heart-burst">
            <span className="text-7xl sm:text-8xl drop-shadow-2xl">💖</span>
          </div>
        )}
      </div>

      {/* Carousel Dots */}
      {totalSlides > 1 && (
        <div className="flex justify-center items-center gap-1.5 py-2.5 bg-white">
          {post.photos.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`h-1.5 rounded-full transition-all ${
                currentSlide === idx ? 'w-5 bg-[#8f4e7c]' : 'w-1.5 bg-[#ead8e2]'
              }`}
            />
          ))}
        </div>
      )}

      {/* 3. Action Bar */}
      <div className="px-4 py-3 sm:px-5 flex items-center justify-between border-t border-[#f5e2ed]/50">
        <div className="flex items-center gap-4">
          {/* Like Heart Button */}
          <button
            type="button"
            onClick={handleManualHeartClick}
            className="flex items-center gap-1.5 text-sm font-semibold text-[#8f4e7c] hover:opacity-80 active:scale-125 transition-transform"
          >
            <span className="text-xl">♥</span>
            <span>{activePhoto.likes_count || 0}</span>
          </button>

          {/* Comment Trigger */}
          <button
            type="button"
            onClick={() => commentInputRef.current?.focus()}
            className="flex items-center gap-1.5 text-sm font-semibold text-[#826e7d] hover:text-[#8f4e7c] transition-colors"
          >
            <span className="text-xl">💬</span>
            <span>{allComments.length}</span>
          </button>

          {/* Download High-Res Button */}
          <button
            type="button"
            onClick={handleDownload}
            title="Download full quality photo"
            className="flex items-center gap-1.5 text-xs font-medium text-[#826e7d] hover:text-[#8f4e7c] p-1 rounded-md transition-colors"
          >
            <span className="text-base">📥</span>
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>

        {/* Double-tap tip */}
        <span className="text-[11px] text-[#a4919f] italic hidden sm:inline">
          Tip: double-tap photo to heart ♡
        </span>
      </div>

      {/* 4. Caption & Comments Section */}
      <div className="px-4 pb-4 sm:px-5 space-y-2 text-sm">
        {/* Caption */}
        {post.caption && (
          <p className="text-[#352b34] leading-relaxed">
            <span className="font-semibold text-[#8f4e7c] mr-2">
              {post.uploader.display_name}
            </span>
            {post.caption}
          </p>
        )}

        {/* Toggle older comments if more than 2 */}
        {allComments.length > 2 && (
          <button
            type="button"
            onClick={() => setShowAllComments(!showAllComments)}
            className="text-xs text-[#8f4e7c] font-semibold hover:underline block pt-1"
          >
            {showAllComments
              ? 'Hide older comments'
              : `View all ${allComments.length} comments...`}
          </button>
        )}

        {/* Existing Comments List */}
        {visibleComments.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {visibleComments.map((c) => (
              <div key={c.id} className="text-xs flex items-baseline gap-1.5 bg-[#fffaf8] p-2 rounded-xl border border-[#f5e2ed]">
                <span className="font-semibold text-[#6e355c] shrink-0">
                  {c.author_name}:
                </span>
                <span className="text-[#352b34]">{c.body}</span>
              </div>
            ))}
          </div>
        )}

        {/* Inline Add Comment Form */}
        <form onSubmit={handleCommentSubmit} className="pt-2 flex gap-2">
          <input
            ref={commentInputRef}
            type="text"
            placeholder="Add a wedding wish or comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-[#ead8e2] bg-[#fffaf8] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#8f4e7c] text-[#352b34]"
          />
          <button
            type="submit"
            disabled={!commentText.trim()}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-[#8f4e7c] text-white hover:bg-[#723c62] disabled:opacity-40 transition-colors"
          >
            Post
          </button>
        </form>
      </div>
    </article>
  );
}
