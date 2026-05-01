import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "sharp",
    "bcryptjs",
    "socket.io",
    "socket.io-client",
    "nodemailer",
    "ioredis",
    "cloudinary",
  ],
  // Increase the body size limit for API routes (mammogram uploads)
  experimental: {
    serverActions: {
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
