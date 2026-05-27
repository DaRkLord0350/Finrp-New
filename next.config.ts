import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Prevent @react-pdf/renderer from being bundled by webpack (Node.js only)
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
