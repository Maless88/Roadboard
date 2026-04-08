import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    CORE_API_URL: process.env.CORE_API_URL ?? 'http://localhost:3001',
    AUTH_URL: process.env.AUTH_URL ?? 'http://localhost:3002',
  },
};

export default nextConfig;
