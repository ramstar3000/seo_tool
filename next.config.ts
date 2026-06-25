import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Mirror server-side Supabase env names into NEXT_PUBLIC_* for client bundles.
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      '',
  },
};

export default nextConfig;
