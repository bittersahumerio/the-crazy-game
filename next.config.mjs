/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent the site from being framed by any origin (clickjacking protection).
          { key: 'X-Frame-Options', value: 'DENY' },
          // Also expressed as CSP so modern browsers enforce it consistently.
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          // Stop browsers from MIME-sniffing response content types.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Limit referrer info sent to third-party origins.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Disable unused browser features.
          { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
