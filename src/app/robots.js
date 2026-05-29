// Next.js generates /robots.txt from this file at build time.
// Public pages: open to crawlers. Admin (/claroscuro) and API: blocked.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://thecrazygame.fun';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/claroscuro/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
