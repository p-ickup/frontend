const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'auth.p-ickup.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'zgunhxopkgbksfoxthpn.supabase.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Allow cross-origin requests from common development IPs
  allowedDevOrigins: [
    '192.168.0.0/16', // Common home network range
    '10.0.0.0/8', // Common private network range
    '172.0.0.0/8', // All 172.x.x.x addresses (covers your IP)
    ...(process.env.ALLOWED_DEV_ORIGINS
      ? process.env.ALLOWED_DEV_ORIGINS.split(',')
      : []),
  ],
}

module.exports = withBundleAnalyzer(nextConfig)

// const withBundleAnalyzer = require("@next/bundle-analyzer")({
//   enabled: process.env.ANALYZE === "true",
// });

// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   experimental: {
//     serverActions: true, // ✅ Enable server actions
//   },
// };

// module.exports = withBundleAnalyzer(nextConfig);
