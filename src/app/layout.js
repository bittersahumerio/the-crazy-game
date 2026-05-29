import { Space_Grotesk, Bebas_Neue } from 'next/font/google';
import AppWalletProvider from '@/components/WalletProvider';
import ReferralCapture from '@/components/ReferralCapture';
import { Suspense } from 'react';
import ToastProvider from '@/components/ToastProvider';
import PausedBanner from '@/components/PausedBanner';
import SourceTracker from '@/components/SourceTracker';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-body',
});

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://thecrazygame.fun';
const SITE_NAME = 'The Crazy Game';
const SITE_DESC = 'The wildest betting game on Solana';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: '%s | The Crazy Game',
  },
  description: SITE_DESC,
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    title: SITE_NAME,
    description: SITE_DESC,
    url: SITE_URL,
    siteName: SITE_NAME,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESC,
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

const THEME_INIT = `
(function() {
  try {
    var saved = localStorage.getItem('theme');
    var theme = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${bebasNeue.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <AppWalletProvider>
          <ToastProvider />
          <PausedBanner />
          <Suspense fallback={null}><ReferralCapture /></Suspense>
          <Suspense fallback={null}><SourceTracker /></Suspense>
          {children}
        </AppWalletProvider>
      </body>
    </html>
  );
}
