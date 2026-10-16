import type { Metadata, Viewport } from 'next';
import { Hanken_Grotesk, Noto_Serif_Malayalam } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui';

const hanken = Hanken_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-hanken', display: 'swap' });
const notoMl = Noto_Serif_Malayalam({ subsets: ['malayalam'], weight: ['700'], variable: '--font-noto-ml', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'അന്നം Annam', template: '%s · Annam' },
  description: 'One patient profile for every plate, every measure and every report.',
  robots: { index: false, follow: false }
};
export const viewport: Viewport = { themeColor: '#183D2B', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${hanken.variable} ${notoMl.variable}`}>
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
