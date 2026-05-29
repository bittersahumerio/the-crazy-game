// Next.js generates /sitemap.xml from this file at build time.
// Lists every public page so crawlers and AI indexers can find them.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://thecrazygame.fun';

export default function sitemap() {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`,            lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${SITE_URL}/games`,       lastModified: now, changeFrequency: 'hourly',  priority: 0.9 },
    { url: `${SITE_URL}/create`,      lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/leaderboard`, lastModified: now, changeFrequency: 'hourly',  priority: 0.8 },
    { url: `${SITE_URL}/faq`,         lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/roadmap`,     lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
  ];
}
