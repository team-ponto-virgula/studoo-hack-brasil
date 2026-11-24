import type { NextConfig } from "next";

const config: NextConfig = {
  agentRules: false,
  devIndicators: false,
  logging: false,
  poweredByHeader: false,
  serverExternalPackages: ["pdfjs-dist", "sharp"],
  transpilePackages: ["@studoo/contratos"],
  async headers() {
    return [
      {
        source: "/marca/:arquivo(.*\\.woff2)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default config;
