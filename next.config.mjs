/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        optimizePackageImports: ['lucide-react', 'react-icons', 'date-fns', 'framer-motion'],
    },
};

export default nextConfig;
