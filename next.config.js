/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true
  },
  experimental: {
    // Disable static generation for pages with useSearchParams
    missingSuspenseWithCSRBailout: false,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://acrobatservices.adobe.com blob: data:; connect-src 'self' https://api.openai.com wss://api.openai.com https://*.anthropic.com https://*.elevenlabs.io wss://*.elevenlabs.io https://acrobatservices.adobe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.googleapis.com https://*.elevenlabs.io; font-src 'self'; media-src 'self' blob: data:; frame-src 'self' https://*.elevenlabs.io https://acrobatservices.adobe.com; worker-src 'self' blob: data:;"
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig