/** @type {import('next').NextConfig} */
const nextConfig = {
    // `next dev` and `next build` must never share a dist dir: the build wipes it
    // and the running dev server starts throwing ENOENT on its manifests.
    // Use the `build:isolated` script to build without touching `.next`.
    distDir: process.env.NEXT_BUILD_ONLY ? '.next-build' : '.next',
    eslint: {
        ignoreDuringBuilds: true,
    },
    // Reuse outgoing HTTP(S) connections (OAuth, SMTP/API calls) instead of
    // paying a TCP/TLS handshake per request; gzip/brotli compress HTML and
    // JSON on the way out (disable with `compress: false` only if a proxy
    // already does it).
    httpAgentOptions: {
        keepAlive: true,
    },
    compress: true,
    poweredByHeader: false,
    // `NEXT_OUTPUT=standalone npm run build` emits a self-contained server
    // bundle for container images that run as several identical replicas.
    output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
    experimental: {
        optimizePackageImports: ['lucide-react', 'react-icons', 'date-fns', 'framer-motion'],
    },
};

export default nextConfig;
