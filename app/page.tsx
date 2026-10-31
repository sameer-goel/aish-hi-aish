'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  supabase,
  Profile,
  Photo,
  UploadBatch,
  getDemoFallbackPhotos,
  EventName,
} from '@/lib/supabase';
import StoryRings, { StoryFilter } from '@/components/StoryRings';
import TimelineCard from '@/components/TimelineCard';
import GalleryLightbox from '@/components/GalleryLightbox';
import GuestModal from '@/components/GuestModal';
import UploadModal from '@/components/UploadModal';
import WhatsAppModal from '@/components/WhatsAppModal';
import HostBar from '@/components/HostBar';

type ActiveView = 'timeline' | 'gallery';

export default function Home() {
  // Current logged in user
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);

  // Data state
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active view and filters
  const [activeView, setActiveView] = useState<ActiveView>('timeline');
  const [activeStoryFilter, setActiveStoryFilter] = useState<StoryFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showHiddenOnly, setShowHiddenOnly] = useState(false);

  // Modals state
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);

  // ---------------------------------------------------------------------------
  // 1. Initialize Guest Session (LocalStorage & WhatsApp Magic-Link Params)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const initSession = async () => {
      // 1. Check URL parameters for WhatsApp Magic Link: ?code=AISH2026&phone=...&name=...&rel=...
      const searchParams = new URLSearchParams(window.location.search);
      const urlCode = searchParams.get('code');
      const urlPhone = searchParams.get('phone');
      const urlName = searchParams.get('name');
      const urlRel = searchParams.get('rel');

      if (urlCode && urlPhone) {
        try {
          const res = await fetch('/api/auth/otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'verify',
              phone: urlPhone,
              inviteCode: urlCode,
              displayName: urlName || 'Wedding Guest',
              relationship: urlRel || 'Guest',
              magic: true,
            }),
          });
          const data = await res.json();
          if (data.ok && data.profile) {
            setCurrentUser(data.profile);
            localStorage.setItem('aish_guest_session', JSON.stringify(data.profile));
            // Clean URL query params without reloading
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
          }
        } catch (err) {
          console.warn('Magic link login error:', err);
        }
      }

      // 2. Read from LocalStorage (and ensure real UUID from DB if it had a placeholder id)
      const saved = localStorage.getItem('aish_guest_session');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.display_name && parsed.id && !String(parsed.id).startsWith('guest-')) {
            setCurrentUser(parsed);
            return;
          }
        } catch {
          // Ignore parse errors
        }
      }

      // 3. Sync default guest with Supabase so currentUser.id is a real database UUID
      try {
        const res = await fetch('/api/auth/otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'verify',
            phone: '+919876543210',
            inviteCode: 'AISH2026',
            displayName: 'Sameer Goel',
            relationship: "Bride's Brother",
            magic: true,
          }),
        });
        const data = await res.json();
        if (data.ok && data.profile) {
          setCurrentUser(data.profile);
          localStorage.setItem('aish_guest_session', JSON.stringify(data.profile));
          return;
        }
      } catch {
        // Fallback below
      }

      const defaultGuest: Profile = {
        id: '659c207b-2461-41ad-8fd3-a62d461e9ff3',
        phone: '+919876543210',
        display_name: 'Sameer Goel',
        relationship: "Bride's Brother",
        role: 'host',
        avatar_color: '#8f4e7c',
        invite_code: 'AISH2026',
        created_at: new Date().toISOString(),
      };
      setCurrentUser(defaultGuest);
    };

    initSession();
  }, []);

  // ---------------------------------------------------------------------------
  // 2. Fetch Photos & Fallback Resilience
  // ---------------------------------------------------------------------------
  const fetchFeed = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch photos with uploader profile and comments
      const { data: dbPhotos, error: photosErr } = await supabase
        .from('photos')
        .select(`
          *,
          uploader:profiles(*),
          comments(*)
        `)
        .order('created_at', { ascending: false });

      if (photosErr || !dbPhotos || dbPhotos.length === 0) {
        console.info('Supabase photos empty or offline, loading DEMO_SAMPLES fallback');
        const fallback = getDemoFallbackPhotos();
        setPhotos(fallback);
      } else {
        setPhotos(dbPhotos as Photo[]);
      }
    } catch (err) {
      console.warn('Failed to fetch from Supabase, loading fallback:', err);
      const fallback = getDemoFallbackPhotos();
      setPhotos(fallback);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();

    // Live Realtime subscription for new WhatsApp & Web uploads/comments
    const channel = supabase
      .channel("aishhiaish-live-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "photos" },
        () => {
          fetchFeed();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments" },
        () => {
          fetchFeed();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFeed]);

  // ---------------------------------------------------------------------------
  // 3. User Actions (Likes, Comments, Moderation)
  // ---------------------------------------------------------------------------
  const handleLikePhoto = async (photoId: string) => {
    // Optimistic UI update
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, likes_count: (p.likes_count || 0) + 1 } : p))
    );

    if (lightboxPhoto && lightboxPhoto.id === photoId) {
      setLightboxPhoto((prev) =>
        prev ? { ...prev, likes_count: (prev.likes_count || 0) + 1 } : null
      );
    }

    // Persist reaction to Supabase
    if (currentUser) {
      try {
        await supabase.from('reactions').insert({
          photo_id: photoId,
          profile_id: currentUser.id,
        });

        // Increment photo likes_count in database
        const target = photos.find((p) => p.id === photoId);
        const newCount = (target?.likes_count || 0) + 1;
        await supabase
          .from('photos')
          .update({ likes_count: newCount })
          .eq('id', photoId);
      } catch (err) {
        console.warn('Like persist warning:', err);
      }
    }
  };

  const handleAddComment = async (photoId: string, commentBody: string) => {
    const authorName = currentUser?.display_name || 'Wedding Guest';
    const authorRel = currentUser?.relationship || 'Guest';
    const authorId = currentUser?.id || 'guest-' + Date.now();

    const newComment = {
      id: 'comment-' + Date.now(),
      photo_id: photoId,
      author_id: authorId,
      author_name: authorName,
      author_relationship: authorRel,
      body: commentBody,
      created_at: new Date().toISOString(),
    };

    // Optimistic UI update
    setPhotos((prev) =>
      prev.map((p) => {
        if (p.id === photoId) {
          return {
            ...p,
            comments: [...(p.comments || []), newComment],
          };
        }
        return p;
      })
    );

    if (lightboxPhoto && lightboxPhoto.id === photoId) {
      setLightboxPhoto((prev) =>
        prev ? { ...prev, comments: [...(prev.comments || []), newComment] } : null
      );
    }

    // Persist to Supabase
    try {
      await supabase.from('comments').insert({
        photo_id: photoId,
        author_id: authorId,
        author_name: authorName,
        author_relationship: authorRel,
        body: commentBody,
      });
    } catch (err) {
      console.warn('Comment persist warning:', err);
    }
  };

  const handleToggleHidePhoto = async (photoId: string) => {
    const target = photos.find((p) => p.id === photoId);
    if (!target) return;
    const nextHidden = !target.is_hidden;

    // Optimistic UI update
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, is_hidden: nextHidden } : p))
    );

    // Persist to Supabase
    try {
      await supabase.from('photos').update({ is_hidden: nextHidden }).eq('id', photoId);
    } catch (err) {
      console.warn('Moderation persist warning:', err);
    }
  };

  const handleBatchIngested = (batch: UploadBatch) => {
    if (batch.photos && batch.photos.length > 0) {
      const nowIso = new Date().toISOString();
      const resolvedUploader = batch.uploader || currentUser || undefined;
      const hydratedPhotos = (batch.photos as Photo[]).map((p) => ({
        ...p,
        created_at: p.created_at || batch.created_at || nowIso,
        uploader: p.uploader || resolvedUploader,
        comments: p.comments || [],
      }));
      setPhotos((prev) => [...hydratedPhotos, ...prev]);
    } else {
      fetchFeed();
    }
  };

  // ---------------------------------------------------------------------------
  // 4. Filtering & Grouping Logic
  // ---------------------------------------------------------------------------
  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      // Host hidden filter
      if (showHiddenOnly) {
        if (!photo.is_hidden) return false;
      } else if (photo.is_hidden && currentUser?.role !== 'host' && currentUser?.role !== 'organizer') {
        return false;
      }

      // Story ring filter
      if (activeStoryFilter === 'Mehendi' && photo.event_name !== 'Mehendi') return false;
      if (activeStoryFilter === 'Sangeet' && photo.event_name !== 'Sangeet') return false;
      if (activeStoryFilter === 'Wedding' && photo.event_name !== 'Wedding') return false;
      if (activeStoryFilter === 'WhatsApp' && photo.source !== 'whatsapp') return false;
      if (activeStoryFilter === 'MyUploads') {
        if (!currentUser?.phone || photo.uploader?.phone !== currentUser.phone) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const captionMatch = (photo.caption || '').toLowerCase().includes(q);
        const nameMatch = (photo.uploader?.display_name || '').toLowerCase().includes(q);
        const relMatch = (photo.uploader?.relationship || '').toLowerCase().includes(q);
        const eventMatch = (photo.event_name || '').toLowerCase().includes(q);
        if (!captionMatch && !nameMatch && !relMatch && !eventMatch) return false;
      }

      return true;
    });
  }, [photos, activeStoryFilter, searchQuery, showHiddenOnly, currentUser]);

  // Group photos into Timeline Post Batches
  const timelinePosts = useMemo(() => {
    const batchMap = new Map<string, Photo[]>();

    filteredPhotos.forEach((photo) => {
      const key = photo.batch_id || `single-${photo.id}`;
      if (!batchMap.has(key)) {
        batchMap.set(key, []);
      }
      batchMap.get(key)!.push(photo);
    });

    const posts: Array<{
      id: string;
      batchId?: string;
      uploader: Profile;
      photos: Photo[];
      eventName: string;
      caption: string;
      source: string;
      createdAt: string;
    }> = [];

    batchMap.forEach((pList, key) => {
      const first = pList[0];
      const uploader: Profile = first.uploader || {
        id: first.uploader_id,
        phone: '+919876543210',
        display_name: 'Wedding Guest',
        relationship: 'Guest',
        role: 'guest',
        avatar_color: '#8f4e7c',
        invite_code: 'AISH2026',
        created_at: first.created_at,
      };

      posts.push({
        id: key,
        batchId: first.batch_id,
        uploader,
        photos: pList,
        eventName: first.event_name,
        caption: first.caption,
        source: first.source,
        createdAt: first.created_at,
      });
    });

    return posts;
  }, [filteredPhotos]);

  // Lightbox Navigation (Next & Previous photo)
  const currentLightboxIndex = lightboxPhoto
    ? filteredPhotos.findIndex((p) => p.id === lightboxPhoto.id)
    : -1;

  const handleLightboxPrev = () => {
    if (currentLightboxIndex > 0) {
      setLightboxPhoto(filteredPhotos[currentLightboxIndex - 1]);
    }
  };

  const handleLightboxNext = () => {
    if (currentLightboxIndex >= 0 && currentLightboxIndex < filteredPhotos.length - 1) {
      setLightboxPhoto(filteredPhotos[currentLightboxIndex + 1]);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fffaf8]">
      {/* ----------------------------------------------------------------------- */}
      {/* 1. Host Dashboard Bar (Visible to Host / Organizer)                    */}
      {/* ----------------------------------------------------------------------- */}
      <HostBar
        currentUser={currentUser}
        photos={photos}
        showHidden={showHiddenOnly}
        onToggleShowHidden={() => setShowHiddenOnly(!showHiddenOnly)}
      />

      {/* ----------------------------------------------------------------------- */}
      {/* 2. Top Navigation Header                                                */}
      {/* ----------------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 bg-[#fffaf8]/90 backdrop-blur-md border-b border-[#ead8e2]/70 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#f6dceb] text-[#894b7a] flex items-center justify-center font-serif-heading font-bold text-lg shadow-inner">
              A♡A
            </div>
            <div>
              <div className="font-serif-heading font-bold text-xl sm:text-2xl text-[#352b34] leading-tight tracking-tight">
                AishHiAish
              </div>
              <div className="text-[9px] tracking-[2.5px] uppercase font-semibold text-[#987d91]">
                WEDDING MOMENTS
              </div>
            </div>
          </div>

          {/* Center View Selector Tabs */}
          <div className="hidden sm:flex items-center p-1 rounded-2xl bg-[#f5e2ed]/60 border border-[#ead8e2]">
            <button
              onClick={() => setActiveView('timeline')}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeView === 'timeline'
                  ? 'bg-white text-[#8f4e7c] shadow-xs'
                  : 'text-[#826e7d] hover:text-[#352b34]'
              }`}
            >
              ✨ Live Timeline
            </button>
            <button
              onClick={() => setActiveView('gallery')}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeView === 'gallery'
                  ? 'bg-white text-[#8f4e7c] shadow-xs'
                  : 'text-[#826e7d] hover:text-[#352b34]'
              }`}
            >
              🖼️ Photo Gallery
            </button>
          </div>

          {/* Right Action Tools & Guest Identity Pill */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* WhatsApp Bot Quick Launcher */}
            <button
              onClick={() => setIsWhatsAppModalOpen(true)}
              title="Open WhatsApp Wedding Bot Concierge"
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 font-semibold text-xs transition-colors flex items-center gap-1.5"
            >
              <span className="text-sm">💬</span>
              <span className="hidden md:inline">WhatsApp Bot</span>
            </button>

            {/* Post Photos Button */}
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[#8f4e7c] hover:bg-[#723c62] text-white font-semibold text-xs shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
            >
              <span>＋</span>
              <span className="hidden sm:inline">Post Photos</span>
            </button>

            {/* Guest Identity Pill */}
            <button
              onClick={() => setIsGuestModalOpen(true)}
              className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-2xl bg-white border border-[#ead8e2] hover:bg-[#fff0f7] transition-colors shadow-2xs group"
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-xs"
                style={{ backgroundColor: currentUser?.avatar_color || '#8f4e7c' }}
              >
                {currentUser?.display_name?.charAt(0).toUpperCase() || 'G'}
              </div>
              <div className="hidden lg:block text-left text-xs">
                <div className="font-semibold text-[#352b34] group-hover:text-[#8f4e7c] truncate max-w-[100px]">
                  {currentUser?.display_name || 'Guest'}
                </div>
                <div className="text-[10px] text-[#826e7d] truncate max-w-[100px]">
                  {currentUser?.relationship || 'Guest'}
                </div>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Sub-Navigation Pill Bar */}
      <div className="sm:hidden flex items-center justify-center p-2 bg-[#fffaf8] border-b border-[#ead8e2]/60">
        <div className="flex items-center p-1 rounded-2xl bg-[#f5e2ed]/60 border border-[#ead8e2] w-full max-w-xs">
          <button
            onClick={() => setActiveView('timeline')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold text-center transition-all ${
              activeView === 'timeline'
                ? 'bg-white text-[#8f4e7c] shadow-xs'
                : 'text-[#826e7d]'
            }`}
          >
            ✨ Live Timeline
          </button>
          <button
            onClick={() => setActiveView('gallery')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold text-center transition-all ${
              activeView === 'gallery'
                ? 'bg-white text-[#8f4e7c] shadow-xs'
                : 'text-[#826e7d]'
            }`}
          >
            🖼️ Photo Gallery
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------------- */}
      {/* 3. Hero Section                                                         */}
      {/* ----------------------------------------------------------------------- */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        <section className="relative rounded-3xl p-8 sm:p-12 text-center border border-[#f1dce5] bg-[radial-gradient(ellipse_at_90%_120%,#fbe9d9_0,transparent_45%),radial-gradient(ellipse_at_0_0,#f9e2ef_0,transparent_60%),#fff7fb] overflow-hidden shadow-sm">
          <div className="inline-block text-[11px] font-bold uppercase tracking-[2.5px] text-[#a45d8e] mb-3">
            CELEBRATING AISHWARYA & ASHISH
          </div>
          <h1 className="font-serif-heading font-bold text-3xl sm:text-5xl text-[#352b34] max-w-2xl mx-auto leading-tight sm:leading-tight">
            Love, laughter & <em className="text-[#a56193] font-normal italic">all the little moments.</em>
          </h1>
          <p className="mt-4 text-xs sm:text-sm text-[#826e7d] max-w-lg mx-auto leading-relaxed">
            One wedding, every perspective. Discover the moments everyone captured across Mehendi, Sangeet & the Wedding, all in one joyful live gallery.
          </p>

          <div className="mt-6 flex flex-wrap justify-center items-center gap-3">
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-6 py-3 rounded-xl bg-[#8c4b79] hover:bg-[#723c62] text-white font-semibold text-sm shadow-md transition-all active:scale-95"
            >
              ＋ Post Wedding Photos
            </button>
            <button
              onClick={() => setIsWhatsAppModalOpen(true)}
              className="px-6 py-3 rounded-xl bg-white border border-[#e9d0df] text-[#80436c] hover:bg-[#fff0f7] font-semibold text-sm transition-all shadow-xs"
            >
              💬 WhatsApp Concierge Drop
            </button>
          </div>
        </section>

        {/* --------------------------------------------------------------------- */}
        {/* 4. Instagram-Style Stories / Event Highlight Rings                    */}
        {/* --------------------------------------------------------------------- */}
        <section className="bg-white rounded-3xl p-4 sm:p-6 border border-[#ead8e2] shadow-2xs">
          <div className="flex items-center justify-between pb-3 px-2 border-b border-[#f5e2ed]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8f4e7c]">
              Event Highlights & Rings
            </span>
            <span className="text-xs text-[#826e7d]">
              Tap ring to filter feed
            </span>
          </div>

          <StoryRings
            activeFilter={activeStoryFilter}
            onSelectFilter={setActiveStoryFilter}
            photos={photos}
            currentPhone={currentUser?.phone}
          />
        </section>

        {/* --------------------------------------------------------------------- */}
        {/* 5. View 1: ✨ Live Timeline Feed (Instagram Post Cards)               */}
        {/* --------------------------------------------------------------------- */}
        {activeView === 'timeline' && (
          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <div>
                <h2 className="font-serif-heading font-bold text-2xl text-[#352b34]">
                  Live Wedding Feed
                </h2>
                <p className="text-xs text-[#826e7d]">
                  Showing {timelinePosts.length} post batches • Newest moments first
                </p>
              </div>

              {/* View Switch Button */}
              <button
                onClick={() => setActiveView('gallery')}
                className="text-xs font-semibold text-[#8f4e7c] hover:underline flex items-center gap-1"
              >
                <span>Switch to Explore Grid</span>
                <span>→</span>
              </button>
            </div>

            {isLoading ? (
              <div className="py-20 text-center text-[#826e7d] text-sm animate-pulse">
                Loading live wedding moments...
              </div>
            ) : timelinePosts.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-3xl border border-[#ead8e2] p-8 space-y-3">
                <div className="text-4xl">📸</div>
                <h3 className="font-serif-heading font-bold text-lg text-[#352b34]">
                  No moments found for this event ring
                </h3>
                <p className="text-xs text-[#826e7d] max-w-sm mx-auto">
                  Be the first to upload a photo or switch your story ring filter back to &quot;All Moments&quot;.
                </p>
                <button
                  onClick={() => setActiveStoryFilter('All')}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#8f4e7c] text-white"
                >
                  Show All Moments
                </button>
              </div>
            ) : (
              timelinePosts.map((post) => (
                <TimelineCard
                  key={post.id}
                  post={post}
                  currentUser={currentUser}
                  onLikePhoto={handleLikePhoto}
                  onAddComment={handleAddComment}
                  onToggleHidePhoto={handleToggleHidePhoto}
                />
              ))
            )}
          </section>
        )}

        {/* --------------------------------------------------------------------- */}
        {/* 6. View 2: 🖼️ Photo Gallery (Instagram Explore Grid + Search)          */}
        {/* --------------------------------------------------------------------- */}
        {activeView === 'gallery' && (
          <section className="space-y-6">
            {/* Gallery Search & Controls Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-[#ead8e2] shadow-2xs">
              <div>
                <h2 className="font-serif-heading font-bold text-xl sm:text-2xl text-[#352b34]">
                  Explore Shared Gallery
                </h2>
                <p className="text-xs text-[#826e7d]">
                  {filteredPhotos.length} moments captured across the celebrations
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Search by guest or caption..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#ead8e2] bg-[#fffaf8] focus:bg-white text-xs text-[#352b34] focus:outline-none focus:ring-1 focus:ring-[#8f4e7c]"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                  🔍
                </span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Responsive Explore Photo Grid */}
            {isLoading ? (
              <div className="py-20 text-center text-[#826e7d] text-sm animate-pulse">
                Loading gallery photos...
              </div>
            ) : filteredPhotos.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-3xl border border-[#ead8e2] p-8 space-y-3">
                <div className="text-4xl">🔍</div>
                <h3 className="font-serif-heading font-bold text-lg text-[#352b34]">
                  No matching photographs found
                </h3>
                <p className="text-xs text-[#826e7d]">
                  Try adjusting your search keywords or story ring filter.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                {filteredPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    onClick={() => setLightboxPhoto(photo)}
                    className="group relative aspect-square rounded-2xl overflow-hidden bg-gray-100 cursor-pointer border border-[#ead8e2] shadow-2xs hover:shadow-md transition-all duration-200"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.public_url}
                      alt={photo.caption || 'Wedding photo'}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />

                    {/* Multi-Photo Carousel Indicator Icon */}
                    {photo.batch_id && (
                      <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white text-xs">
                        ❐
                      </div>
                    )}

                    {/* Source Tag if WhatsApp */}
                    {photo.source === 'whatsapp' && (
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-emerald-600/90 text-white text-[10px] font-semibold">
                        WhatsApp
                      </div>
                    )}

                    {/* Hover Explore Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3 text-white">
                      <div className="text-[11px] font-medium truncate">
                        {photo.uploader?.display_name || 'Guest'} • {photo.event_name}
                      </div>

                      <div className="flex items-center justify-center gap-4 text-sm font-bold">
                        <span className="flex items-center gap-1">
                          ♥ {photo.likes_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          💬 {photo.comments?.length || 0}
                        </span>
                      </div>

                      <div className="text-[10px] text-white/80 truncate">
                        {photo.caption || 'Tap to view full resolution'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* ----------------------------------------------------------------------- */}
      {/* 7. Footer                                                               */}
      {/* ----------------------------------------------------------------------- */}
      <footer className="mt-16 border-t border-[#ead8e2] bg-white py-8 text-center text-xs text-[#826e7d]">
        <div className="max-w-5xl mx-auto px-4 space-y-2">
          <div className="font-serif-heading font-bold text-base text-[#352b34]">
            Aishwarya & Ashish Wedding Moments
          </div>
          <p>
            Celebrating love, laughter & forever ♡ Designed with royal berry & blush palette.
          </p>
          <div className="pt-2 text-[11px] text-[#a4919f]">
            Next.js 16.4.3 • React 19 • Supabase Storage • WhatsApp Cloud API
          </div>
        </div>
      </footer>

      {/* ----------------------------------------------------------------------- */}
      {/* 8. Modals & Dialogs                                                     */}
      {/* ----------------------------------------------------------------------- */}
      <GuestModal
        isOpen={isGuestModalOpen}
        onClose={() => setIsGuestModalOpen(false)}
        currentProfile={currentUser}
        onProfileUpdate={setCurrentUser}
      />

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        currentUser={currentUser}
        existingPhotos={photos}
        onUploadSuccess={handleBatchIngested}
      />

      <WhatsAppModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        currentUser={currentUser}
        onBatchIngested={handleBatchIngested}
      />

      <GalleryLightbox
        photo={lightboxPhoto}
        onClose={() => setLightboxPhoto(null)}
        onPrev={currentLightboxIndex > 0 ? handleLightboxPrev : undefined}
        onNext={
          currentLightboxIndex < filteredPhotos.length - 1 ? handleLightboxNext : undefined
        }
        currentUser={currentUser}
        onLikePhoto={handleLikePhoto}
        onAddComment={handleAddComment}
      />
    </div>
  );
}
