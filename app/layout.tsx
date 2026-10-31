import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AishHiAish | Celebrating Aishwarya & Ashish • Wedding Moments',
  description:
    'One wedding, every perspective. Live timeline feed, shared photo gallery, multi-photo web upload, and instant WhatsApp Bot photo ingestion for Aishwarya & Ashish.',
  keywords: ['AishHiAish', 'Wedding Moments', 'Aishwarya', 'Ashish', 'Sangeet', 'Mehendi', 'Wedding Gallery'],
  openGraph: {
    title: 'AishHiAish | Wedding Moments • Shared Album',
    description: 'Celebrate love & laughter. Upload, view, and react to wedding moments via Web and WhatsApp Bot!',
    siteName: 'AishHiAish Wedding Moments',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#fffaf8',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#fffaf8] text-[#352b34] antialiased">
        {children}
      </body>
    </html>
  );
}
