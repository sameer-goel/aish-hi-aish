'use client';
import { useEffect } from 'react';

export default function GalleryShortRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const phone = params.get('p') || '+31682403239';
    const name = params.get('n') || 'Sameer Goel';
    const rel = params.get('r') || "Bride's Brother";
    window.location.replace(
      `/?code=AISH2026&phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(name)}&rel=${encodeURIComponent(rel)}&view=gallery`
    );
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fffaf8] text-[#8f4e7c] font-serif text-lg">
      Opening AishHiAish Shared Photo Gallery... 🖼️
    </div>
  );
}
