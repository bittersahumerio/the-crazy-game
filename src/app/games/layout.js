const T = 'Active games';
const D = 'Live betting games on The Crazy Game. Place a bet, hold the spot, take the pot.';

export const metadata = {
  title: T,
  description: D,
  alternates: { canonical: '/games' },
  openGraph: {
    title: `${T} | The Crazy Game`,
    description: D,
    url: '/games',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${T} | The Crazy Game`,
    description: D,
  },
};

export default function GamesLayout({ children }) {
  return children;
}
