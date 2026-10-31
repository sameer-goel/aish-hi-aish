'use client';

import React, { useState } from 'react';
import { Profile, UploadBatch } from '@/lib/supabase';
import { DEMO_SAMPLES } from '@/lib/demo-samples';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Profile | null;
  onBatchIngested: (batch: UploadBatch) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text?: string;
  imageUrl?: string;
  magicLink?: string;
  timestamp: string;
}

export default function WhatsAppModal({
  isOpen,
  onClose,
  currentUser,
  onBatchIngested,
}: WhatsAppModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'bot',
      text: 'Namaste! 💍 Welcome to the AishHiAish Wedding Moments Concierge!\n\nSend your photos here and they will instantly publish to the Live Wedding Feed and Gallery.',
      timestamp: '10:00 AM',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const phone = currentUser?.phone || '+919876543210';
  const profileName = currentUser?.display_name || 'Rohan';
  const relationship = currentUser?.relationship || "Groom's Squad";

  const handleSendMessage = async (customText?: string, customImg?: string) => {
    const textToSend = customText !== undefined ? customText : inputText;
    const imgToSend = customImg !== undefined ? customImg : attachedImage;

    if (!textToSend.trim() && !imgToSend) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsgId = 'msg-' + Date.now();

    // Add user message to chat UI
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        text: textToSend,
        imageUrl: imgToSend || undefined,
        timestamp: timeStr,
      },
    ]);

    setInputText('');
    setAttachedImage(null);
    setIsSending(true);

    try {
      const mediaItems = imgToSend
        ? [
            {
              url: imgToSend,
              base64: imgToSend.startsWith('data:') ? imgToSend : undefined,
              filename: `wa-${Date.now()}.jpg`,
            },
          ]
        : [];

      // Call real webhook endpoint
      const res = await fetch('/api/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          profileName,
          relationship,
          caption: textToSend,
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
            text: data.botReply || 'Received your moments!',
            magicLink: data.magicLink,
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

  // Quick Action presets for testing
  const sendHi = () => {
    handleSendMessage('Hi! Can I get the link to view photos?');
  };

  const sendMehendiPhoto = () => {
    const sample = DEMO_SAMPLES[0];
    handleSendMessage('Mehendi vibes with the bride! 🌿 #mehendi', sample.url);
  };

  const sendSangeetPhoto = () => {
    const sample = DEMO_SAMPLES[1];
    handleSendMessage('Unbelievable Sangeet energy! 🔥 #sangeet', sample.url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-[#ead8e2] overflow-hidden flex flex-col h-[85vh] max-h-[700px] animate-in fade-in zoom-in-95">
        {/* WhatsApp Top Green Header */}
        <div className="bg-[#075e54] text-white p-3.5 sm:p-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#128c7e] flex items-center justify-center text-lg font-bold border-2 border-white/40">
              💍
            </div>
            <div>
              <h3 className="font-semibold text-sm tracking-wide">
                AishHiAish Wedding Bot
              </h3>
              <p className="text-[11px] text-emerald-100 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
                Official Wedding Concierge • Online
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/20 text-white font-mono">
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

        {/* WhatsApp Connect Guide & Webhook Info Card */}
        <div className="bg-[#efeae2] p-2.5 border-b border-[#ddd6ce] text-xs text-[#54656f] flex items-center justify-between gap-2">
          <span>
            <b>Guest Channel:</b> Guests upload via WhatsApp without installing an app.
          </span>
          <a
            href="https://wa.me/919876543210?text=Hi%20AishHiAish"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#00a884] font-semibold hover:underline shrink-0"
          >
            wa.me Link ↗
          </a>
        </div>

        {/* Quick Testing Actions */}
        <div className="bg-[#f0f2f5] p-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-[#e9edef]">
          <span className="text-[10px] font-semibold text-[#667781] uppercase px-1 shrink-0">
            Simulate:
          </span>
          <button
            onClick={sendHi}
            disabled={isSending}
            className="px-2.5 py-1 text-xs rounded-full bg-white border border-[#d1d7db] text-[#111b21] hover:bg-[#e9edef] whitespace-nowrap shadow-2xs font-medium"
          >
            👋 Send &quot;Hi&quot;
          </button>
          <button
            onClick={sendMehendiPhoto}
            disabled={isSending}
            className="px-2.5 py-1 text-xs rounded-full bg-white border border-[#d1d7db] text-emerald-800 hover:bg-emerald-50 whitespace-nowrap shadow-2xs font-medium"
          >
            🌿 Drop Mehendi Photo
          </button>
          <button
            onClick={sendSangeetPhoto}
            disabled={isSending}
            className="px-2.5 py-1 text-xs rounded-full bg-white border border-[#d1d7db] text-pink-800 hover:bg-pink-50 whitespace-nowrap shadow-2xs font-medium"
          >
            💃 Drop Sangeet Squad
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
                  {/* Attached Image Preview in chat */}
                  {m.imageUrl && (
                    <div className="mb-2 rounded-xl overflow-hidden max-h-48 bg-black/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.imageUrl}
                        alt="whatsapp media"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <p className="break-words [overflow-wrap:anywhere]">{m.text}</p>
                  {m.magicLink && (
                    <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                      <a
                        href={m.magicLink}
                        onClick={(e) => {
                          e.preventDefault();
                          onClose();
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold text-xs transition-colors"
                      >
                        <span>✨ View Live Wedding Feed</span>
                        <span>↗</span>
                      </a>
                      <span className="text-[10px] text-gray-400 truncate max-w-[140px]" title={m.magicLink}>
                        Magic Link Ready
                      </span>
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
                Bot is typing...
              </div>
            </div>
          )}
        </div>

        {/* Image Attachment Preview */}
        {attachedImage && (
          <div className="p-2 bg-[#f0f2f5] border-t border-[#e9edef] flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachedImage}
                alt="attachment preview"
                className="w-10 h-10 rounded-lg object-cover"
              />
              <span className="text-xs text-[#54656f]">1 photo attached to drop</span>
            </div>
            <button
              onClick={() => setAttachedImage(null)}
              className="text-xs text-red-500 hover:text-red-700 font-semibold px-2"
            >
              Remove
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="bg-[#f0f2f5] p-3 border-t border-[#e9edef] flex items-center gap-2">
          {/* Attach Sample Photo Button */}
          <button
            type="button"
            onClick={() => setAttachedImage(DEMO_SAMPLES[Math.floor(Math.random() * DEMO_SAMPLES.length)].url)}
            title="Attach a sample photo"
            className="w-10 h-10 rounded-full bg-white hover:bg-gray-100 text-gray-600 flex items-center justify-center text-lg shadow-2xs border border-[#d1d7db] transition-colors"
          >
            📎
          </button>

          <input
            type="text"
            placeholder="Type a message or caption (#sangeet, #mehendi)..."
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
            disabled={isSending || (!inputText.trim() && !attachedImage)}
            className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#069375] text-white flex items-center justify-center text-base shadow-sm transition-transform active:scale-95 disabled:opacity-40"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
