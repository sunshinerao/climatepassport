/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === "development";

const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  transpilePackages: ["@climate-passport/passport-core"],
  // Keep dev output separate so running `next build` doesn't invalidate active `next dev` chunks.
  distDir: isDev ? ".next-dev" : ".next",
  allowedDevOrigins: ["localhost", "127.0.0.1"],
};

export default nextConfig;
