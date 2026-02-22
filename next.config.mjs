/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // 큰 파일 업로드를 위한 설정
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
}

export default nextConfig
