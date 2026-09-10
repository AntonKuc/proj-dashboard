/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // We run eslint ourselves via `npm run lint` (and CI); don't block builds on it.
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
