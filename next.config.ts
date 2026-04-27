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
  ],
};

export default nextConfig;
