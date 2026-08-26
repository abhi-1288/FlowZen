function getBaseDomain() {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return process.env.VERCEL_PROJECT_PRODUCTION_URL;
  }
  if (process.env.VERCEL_URL) {
    return process.env.VERCEL_URL;
  }
  return "localhost";
}

/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        BASE_DOMAIN: getBaseDomain(),
    },
    experimental: {
        optimizePackageImports: ['lucide-react', 'react-icons', 'date-fns', 'framer-motion'],
    },
};

export default nextConfig;
