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
        hostname: 'zgunhxopkgbksfoxthpn.supabase.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
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
