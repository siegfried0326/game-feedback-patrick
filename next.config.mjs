/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb', // 관리자 파일 업로드 최대 500MB
    },
  },
  // 보안 헤더
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pay.nicepay.co.kr",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.supabase.co https://*.nicepay.co.kr https://*.googleusercontent.com https://*.kakaocdn.net https://*.apple.com",
              "connect-src 'self' https://*.supabase.co https://api.nicepay.co.kr https://pay.nicepay.co.kr https://api.anthropic.com https://generativelanguage.googleapis.com",
              "frame-src https://pay.nicepay.co.kr https://*.nicepay.co.kr",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self' https://pay.nicepay.co.kr",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
