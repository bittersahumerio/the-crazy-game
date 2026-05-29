const T = 'FAQ';
const D = 'How The Crazy Game works: timer, bets, ROI, payouts, and salvador mode.';

export const metadata = {
  title: T,
  description: D,
  alternates: { canonical: '/faq' },
  openGraph: {
    title: `${T} | The Crazy Game`,
    description: D,
    url: '/faq',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${T} | The Crazy Game`,
    description: D,
  },
};

export default function FAQLayout({ children }) {
  return children;
}
