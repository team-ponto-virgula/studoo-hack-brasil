import type { NextConfig } from "next";

const config: NextConfig = {
  agentRules: false,
  devIndicators: false,
  logging: false,
  poweredByHeader: false,
  serverExternalPackages: ["pdfjs-dist", "sharp"],
  transpilePackages: ["@studoo/contratos"],
};

export default config;
