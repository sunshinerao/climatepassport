import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === "development";
const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  transpilePackages: ["@climate-passport/passport-core"],
  // Keep dev output separate so running `next build` doesn't invalidate active `next dev` chunks.
  distDir: isDev ? ".next-dev" : ".next",
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  experimental: {
    outputFileTracingRoot: monorepoRoot,
    outputFileTracingIncludes: {
      "/api/**/*": ["../../node_modules/@fontsource-variable/noto-sans-sc/**/*"],
    },
  },
};

export default nextConfig;
