const T = 'Roadmap';
const D = "What's shipped and what's coming on The Crazy Game.";

export const metadata = {
  title: T,
  description: D,
  alternates: { canonical: '/roadmap' },
  openGraph: {
    title: `${T} | The Crazy Game`,
    description: D,
    url: '/roadmap',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${T} | The Crazy Game`,
    description: D,
  },
};

export default function RoadmapLayout({ children }) {
  return children;
}
