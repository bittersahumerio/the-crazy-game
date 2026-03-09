import { Space_Grotesk, Bebas_Neue } from 'next/font/google';
import AppWalletProvider from '@/components/WalletProvider';
import ToastProvider from '@/components/ToastProvider';
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

export const metadata = {
  title: 'The Crazy Game',
  description: 'The wildest betting game on Solana',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${bebasNeue.variable}`}>
      <body>
        <AppWalletProvider>
          <ToastProvider />
          {children}
        </AppWalletProvider>
      </body>
    </html>
  );
}