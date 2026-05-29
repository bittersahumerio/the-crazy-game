const T = 'Create a game';
const D = 'Create your own betting game on The Crazy Game. Set the timer, ROI rate, host fee, and salvador mode.';

export const metadata = {
  title: T,
  description: D,
  alternates: { canonical: '/create' },
  openGraph: {
    title: `${T} | The Crazy Game`,
    description: D,
    url: '/create',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${T} | The Crazy Game`,
    description: D,
  },
};

export default function CreateLayout({ children }) {
  return children;
}
