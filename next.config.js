/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENFDA_API_KEY: process.env.OPENFDA_API_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, '.'),
    }
    return config
  },
};

module.exports = nextConfig;
