import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The frontend is its own project root. Pinned explicitly because the repository root also has a package-lock.json,
// which otherwise makes Next.js infer the wrong workspace root (bundling and output file tracing must agree).
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // next/image is not used anywhere in the app. No remote hosts are allowed, so the /_next/image optimizer can never be
  // used as an open proxy for arbitrary HTTPS hosts (the previous `hostname: '**'` allowed exactly that). Add specific
  // hosts here if remote images are ever introduced.
  images: {
    formats: ['image/webp'],
    remotePatterns: [],
  },

  experimental: {
    optimizePackageImports: [
      '@radix-ui/react-icons',
      'lucide-react',
    ],
  },

  // Turbopack is the Next.js 16 default production bundler. The former custom webpack splitChunks block (vendor / React
  // chunk grouping) was a performance tweak only; Turbopack performs its own chunking.
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
