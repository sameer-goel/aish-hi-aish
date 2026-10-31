'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Profile, UploadBatch, stripExifAndCompressImage } from '@/lib/supabase';
import { DEMO_SAMPLES } from '@/lib/demo-samples';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Profile | null;
  onBatchIngested: (batch: UploadBatch) => void;
  onNavigateView?: (view: "timeline" | "gallery") => void;
}

interface AttachedMedia {
  id: string;
  name: string;
  dataUrl: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  senderName?: string;
  senderTitle?: string;
  text?: string;
  imageUrls?: string[];
  magicLink?: string;
  galleryLink?: string;
  timestamp: string;
}

const UPLOADER_TITLE_PRESETS = [
  "Bride's Brother",
  "Bride's Sister",
  "Bride's Parents",
  "Groom's Brother",
  "Groom's Sister",
  "Bride's Mama Ji / Family",
  "Groom's Squad",
  "Bride's Best Friend",
  "College Friend",
  "Organizing Team",
];

export default function WhatsAppModal({
  isOpen,
  onClose,
  currentUser,
  onBatchIngested,
  onNavigateView,
}: WhatsAppModalProps) {
  const [senderPhone, setSenderPhone] = useState(currentUser?.phone || '+919876543210');
  const [senderName, setSenderName] = useState(currentUser?.display_name || 'Sameer Goel');
  const [senderTitle, setSenderTitle] = useState(currentUser?.relationship || "Bride's Brother");
  const [selectedEvent, setSelectedEvent] = useState<'Mehendi' | 'Sangeet' | 'Wedding'>('Sangeet');

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'bot',
      text: 'Namaste! 💍 Welcome to the AishHiAish WhatsApp Wedding Bot!\n\nTap 📎 below to select photos from your phone/computer, type a moment title/caption, and hit ➤ to publish directly to the Live Wedding Timeline under your Name & Title!',
      timestamp: '10:00 AM',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [attachedMedia, setAttachedMedia] = useState<AttachedMedia[]>([]);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser) {
      if (currentUser.phone) setSenderPhone(currentUser.phone);
      if (currentUser.display_name) setSenderName(currentUser.display_name);
      if (currentUser.relationship) setSenderTitle(currentUser.relationship);
    }
  }, [currentUser]);

  if (!isOpen) return null;

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newMedia: AttachedMedia[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const { dataUrl } = await stripExifAndCompressImage(file, 1920, 0.88);
        newMedia.push({
          id: `wa-file-${Date.now()}-${i}`,
          name: file.name,
          dataUrl,
        });
      } catch {
        // Fallback FileReader
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.readAsDataURL(file);
        });
        if (dataUrl) {
          newMedia.push({
            id: `wa-file-${Date.now()}-${i}`,
            name: file.name,
            dataUrl,
          });
        }
      }
    }
    setAttachedMedia((prev) => [...prev, ...newMedia]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendMessage = async (
    customText?: string,
    customImages?: AttachedMedia[],
    customEvent?: 'Mehendi' | 'Sangeet' | 'Wedding'
  ) => {
    const textToSend = customText !== undefined ? customText : inputText;
    const imgsToSend = customImages !== undefined ? customImages : attachedMedia;
    const eventToUse = customEvent || selectedEvent;

    if (!textToSend.trim() && imgsToSend.length === 0) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsgId = 'msg-' + Date.now();

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        senderName,
        senderTitle,
        text: textToSend || `${eventToUse} moments shared by ${senderName} (${senderTitle}) ✨`,
        imageUrls: imgsToSend.map((m) => m.dataUrl),
        timestamp: timeStr,
      },
    ]);

    setInputText('');
    setAttachedMedia([]);
    setIsSending(true);

    try {
      const mediaItems = imgsToSend.map((item, idx) => ({
        url: item.dataUrl,
        base64: item.dataUrl.startsWith('data:') ? item.dataUrl : undefined,
        filename: item.name || `wa-${Date.now()}-${idx}.jpg`,
      }));

      const res = await fetch('/api/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: senderPhone,
          profileName: senderName,
          relationship: senderTitle,
          eventName: eventToUse,
          caption: textToSend || `${eventToUse} moments ✨`,
          text: textToSend,
          mediaItems,
        }),
      });

      const data = await res.json();
      const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (data.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: 'bot-' + Date.now(),
            sender: 'bot',
            text: data.botReply || 'Published to Timeline!',
            magicLink: data.magicLink,
            galleryLink: data.galleryLink,
            timestamp: botTime,
          },
        ]);

        if (data.batch) {
          onBatchIngested(data.batch);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: 'bot-err-' + Date.now(),
            sender: 'bot',
            text: '⚠️ ' + (data.error || 'Failed to process message'),
            timestamp: botTime,
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'bot-err-' + Date.now(),
          sender: 'bot',
          text: '⚠️ Network error: ' + err.message,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const sendHi = () => {
    handleSendMessage('Hi! Can I get the link to view photos?', []);
  };

  const makeUniqueSampleDataUrl = async (baseUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width || 800;
        canvas.height = img.height || 600;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          // Stamp 1 subtle unique pixel so each demo drop gets a fresh SHA-256 receipt
          ctx.fillStyle = `rgb(${Date.now() % 255}, ${(Date.now() >> 4) % 255}, 180)`;
          ctx.fillRect(0, 0, 1, 1);
          resolve(canvas.toDataURL("image/jpeg", 0.9));
        } else {
          resolve(baseUrl);
        }
      };
      img.onerror = () => resolve(baseUrl);
      img.src = baseUrl;
    });
  };

  const sendMehendiPhoto = async () => {
    const sample = DEMO_SAMPLES[0];
    const uniqueUrl = await makeUniqueSampleDataUrl(sample.url);
    handleSendMessage(
      inputText.trim() || 'Bride Mehendi Glow & Henna Details 🌿✨ #mehendi',
      [{ id: 'sample-m-' + Date.now(), name: 'mehendi.jpg', dataUrl: uniqueUrl }],
      'Mehendi'
    );
  };

  const sendSangeetPhoto = async () => {
    const sample = DEMO_SAMPLES[4];
    const uniqueUrl = await makeUniqueSampleDataUrl(sample.url);
    handleSendMessage(
      inputText.trim() || 'Family Sangeet Dance Floor on Fire! 💃🔥 #sangeet',
      [{ id: 'sample-s-' + Date.now(), name: 'sangeet.jpg', dataUrl: uniqueUrl }],
      'Sangeet'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-[#ead8e2] overflow-hidden flex flex-col h-[90vh] max-h-[760px] animate-in fade-in zoom-in-95">
        {/* WhatsApp Top Green Header */}
        <div className="bg-[#075e54] text-white p-3.5 sm:p-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#128c7e] flex items-center justify-center text-lg font-bold border-2 border-white/40">
              💍
            </div>
            <div>
              <h3 className="font-semibold text-sm tracking-wide">
                AishHiAish WhatsApp Timeline Bot
              </h3>
              <p className="text-[11px] text-emerald-100 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
                Uploads directly to Live Timeline with Uploader&apos;s Title
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-[11px] px-2.5 py-1 rounded-full bg-white/20 text-white font-mono">
              /api/whatsapp/webhook
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Uploader Identity & Title Bar (Who is sending on WhatsApp) */}
        <div className="bg-[#f8f5f2] px-3.5 py-2.5 border-b border-[#e2ddd5] space-y-2">
          <div className="flex items-center justify-between text-[11px] text-[#54656f]">
            <span className="font-semibold text-[#075e54] uppercase tracking-wider">
              👤 WhatsApp Uploader Identity & Title (Appears on Timeline Post)
            </span>
            <a
              href="https://wa.me/15552131047?text=Hi%20AishHiAish"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#00a884] font-semibold hover:underline shrink-0"
            >
              Message +1 (555) 213-1047 on WhatsApp ↗
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-0.5">
                Uploader Name
              </label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="e.g. Sameer Goel"
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#d1d7db] text-xs font-semibold text-[#111b21] focus:outline-none focus:ring-1 focus:ring-[#00a884]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-0.5">
                Uploader Title / Relation
              </label>
              <input
                type="text"
                list="uploader-title-presets"
                value={senderTitle}
                onChange={(e) => setSenderTitle(e.target.value)}
                placeholder="e.g. Bride's Brother"
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#d1d7db] text-xs font-semibold text-[#8f4e7c] focus:outline-none focus:ring-1 focus:ring-[#00a884]"
              />
              <datalist id="uploader-title-presets">
                {UPLOADER_TITLE_PRESETS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-0.5">
                Event Album
              </label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value as 'Mehendi' | 'Sangeet' | 'Wedding')}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#d1d7db] text-xs font-semibold text-[#111b21] focus:outline-none focus:ring-1 focus:ring-[#00a884]"
              >
                <option value="Mehendi">🌿 Mehendi</option>
                <option value="Sangeet">💃 Sangeet</option>
                <option value="Wedding">👑 The Wedding</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quick Testing Actions */}
        <div className="bg-[#f0f2f5] px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-[#e9edef]">
          <span className="text-[10px] font-semibold text-[#667781] uppercase px-1 shrink-0">
            Quick Actions:
          </span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
            className="px-2.5 py-1 text-xs rounded-full bg-[#00a884] text-white hover:bg-[#069375] whitespace-nowrap shadow-2xs font-semibold"
          >
            📸 Choose Photos from Device
          </button>
          <button
            type="button"
            onClick={sendMehendiPhoto}
            disabled={isSending}
            className="px-2.5 py-1 text-xs rounded-full bg-white border border-[#d1d7db] text-emerald-800 hover:bg-emerald-50 whitespace-nowrap shadow-2xs font-medium"
          >
            🌿 Drop Mehendi Photo
          </button>
          <button
            type="button"
            onClick={sendSangeetPhoto}
            disabled={isSending}
            className="px-2.5 py-1 text-xs rounded-full bg-white border border-[#d1d7db] text-pink-800 hover:bg-pink-50 whitespace-nowrap shadow-2xs font-medium"
          >
            💃 Drop Sangeet Squad
          </button>
          <button
            type="button"
            onClick={sendHi}
            disabled={isSending}
            className="px-2.5 py-1 text-xs rounded-full bg-white border border-[#d1d7db] text-[#111b21] hover:bg-[#e9edef] whitespace-nowrap shadow-2xs font-medium"
          >
            👋 Send &quot;Hi&quot;
          </button>
        </div>

        {/* Chat Messages Body (WhatsApp Wallpaper Style) */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#efeae2]/60 bg-[radial-gradient(#cfc6bc_1px,transparent_1px)] [background-size:16px_16px]">
          {messages.map((m) => {
            const isUser = m.sender === 'user';
            return (
              <div
                key={m.id}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3 shadow-xs text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${
                    isUser
                      ? 'bg-[#d9fdd3] text-[#111b21] rounded-tr-none'
                      : 'bg-white text-[#111b21] rounded-tl-none border border-[#e2ddd5]'
                  }`}
                >
                  {/* Sender Identity & Title Header on User Bubble */}
                  {isUser && m.senderName && (
                    <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-emerald-700/15 text-[11px]">
                      <span className="font-bold text-[#075e54]">{m.senderName}</span>
                      {m.senderTitle && (
                        <span className="px-2 py-0.5 rounded-full bg-white/80 text-[#8f4e7c] font-semibold text-[10px]">
                          {m.senderTitle}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Attached Image Previews in chat */}
                  {m.imageUrls && m.imageUrls.length > 0 && (
                    <div className={`mb-2 grid gap-1.5 rounded-xl overflow-hidden ${m.imageUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {m.imageUrls.map((url, idx) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={idx}
                          src={url}
                          alt="whatsapp media"
                          className="w-full max-h-48 object-cover rounded-lg"
                        />
                      ))}
                    </div>
                  )}

                  <p className="break-words [overflow-wrap:anywhere]">{m.text}</p>
                  {m.magicLink && (
                    <div className="mt-3 pt-2.5 border-t border-gray-200/80 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (onNavigateView) onNavigateView("timeline");
                          onClose();
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#8f4e7c] hover:bg-[#723c62] text-white font-semibold text-xs shadow-2xs transition-all active:scale-95"
                      >
                        <span>✨</span>
                        <span>View Timeline</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onNavigateView) onNavigateView("gallery");
                          onClose();
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-2xs transition-all active:scale-95"
                      >
                        <span>🖼️</span>
                        <span>View Gallery</span>
                      </button>
                    </div>
                  )}
                  <span
                    className={`block text-[10px] text-right mt-1 ${
                      isUser ? 'text-[#53bdeb]' : 'text-[#667781]'
                    }`}
                  >
                    {m.timestamp} {isUser && '✓✓'}
                  </span>
                </div>
              </div>
            );
          })}
          {isSending && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl p-2.5 text-xs text-[#667781] shadow-xs animate-pulse">
                Uploading to Wedding Timeline as {senderName} ({senderTitle})...
              </div>
            </div>
          )}
        </div>

        {/* Multi-Photo Attachment Preview Tray */}
        {attachedMedia.length > 0 && (
          <div className="p-2.5 bg-[#f0f2f5] border-t border-[#e9edef] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 overflow-x-auto">
              {attachedMedia.map((item) => (
                <div key={item.id} className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.dataUrl}
                    alt={item.name}
                    className="w-12 h-12 rounded-lg object-cover border border-emerald-500"
                  />
                </div>
              ))}
              <div className="text-xs text-[#111b21]">
                <div className="font-semibold">{attachedMedia.length} photo(s) ready to post</div>
                <div className="text-[10px] text-[#54656f]">
                  Posting as <b>{senderName}</b> ({senderTitle})
                </div>
              </div>
            </div>
            <button
              onClick={() => setAttachedMedia([])}
              className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 shrink-0"
            >
              Clear
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="bg-[#f0f2f5] p-3 border-t border-[#e9edef] flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => handleFilesSelected(e.target.files)}
            className="hidden"
          />

          {/* Attach Real Photos Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Select photos from your phone or computer"
            className="w-10 h-10 rounded-full bg-white hover:bg-emerald-50 text-[#075e54] flex items-center justify-center text-lg shadow-2xs border border-[#d1d7db] transition-colors shrink-0"
          >
            📎
          </button>

          <input
            type="text"
            placeholder={`Add post title / caption as ${senderName} (${senderTitle})...`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendMessage();
            }}
            className="flex-1 px-4 py-2.5 rounded-2xl bg-white border border-[#d1d7db] text-xs sm:text-sm text-[#111b21] focus:outline-none focus:ring-1 focus:ring-[#00a884]"
          />

          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={isSending || (!inputText.trim() && attachedMedia.length === 0)}
            className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#069375] text-white flex items-center justify-center text-base shadow-sm transition-transform active:scale-95 disabled:opacity-40 shrink-0"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
