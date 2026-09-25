/** @type {import('next').NextConfig} */
const nextConfig = {
  // Image optimization for faster loading and smaller bundle sizes
  images: {
    formats: ['image/avif', 'image/webp'],
    unoptimized: false, // Enable Next.js image optimization
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  
  // Experimental optimizations
  experimental: {
    optimizePackageImports: [
      '@radix-ui/react-icons',
      'lucide-react',
    ],
    // Without this, Next.js's webpack bundler inlines @prisma/client into
    // each API route's compiled output, which breaks Prisma's own relative
    // lookup for its native query-engine binary at runtime — surfacing as
    // "PrismaClientInitializationError ... built on Vercel" during build-time
    // page-data collection, even though `prisma generate` ran successfully.
    // Marking it external tells Next.js to resolve it via normal node_modules
    // require() instead of bundling it, exactly like Prisma's own Next.js
    // deployment docs recommend.
    serverComponentsExternalPackages: ['@prisma/client', '.prisma/client'],
  },

  // Bundle analysis for optimization insights
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // Separate vendor code into its own chunk
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: 10,
              reuseExistingChunk: true,
            },
            // Separate React into its own dedicated chunk
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              name: 'react-vendors',
              priority: 20,
              reuseExistingChunk: true,
            },
            // Common shared modules between chunks
            common: {
              minChunks: 2,
              priority: 5,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
