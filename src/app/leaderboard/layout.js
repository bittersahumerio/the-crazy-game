const T = 'Leaderboard';
const D = 'Top players on The Crazy Game by platform fees paid this week. Weekly USDC payouts.';

export const metadata = {
  title: T,
  description: D,
  alternates: { canonical: '/leaderboard' },
  openGraph: {
    title: `${T} | The Crazy Game`,
    description: D,
    url: '/leaderboard',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${T} | The Crazy Game`,
    description: D,
  },
};

export default function LeaderboardLayout({ children }) {
  return children;
}
