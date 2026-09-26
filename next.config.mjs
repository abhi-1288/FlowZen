/** @type {import('next').NextConfig} */
const nextConfig = {
    // `next dev` and `next build` must never share a dist dir: the build wipes it
    // and the running dev server starts throwing ENOENT on its manifests.
    // Use the `build:isolated` script to build without touching `.next`.
    distDir: process.env.NEXT_BUILD_ONLY ? '.next-build' : '.next',
    experimental: {
        optimizePackageImports: ['lucide-react', 'react-icons', 'date-fns', 'framer-motion'],
    },
};

export default nextConfig;
