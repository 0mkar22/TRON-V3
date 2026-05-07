/** @type {import('next').NextConfig} */
const nextConfig = {
    // 🌟 THE BRIDGE: This tells Next.js it is safe to send these to the browser
    env: {
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    }
};

export default nextConfig;