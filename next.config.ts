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
          // Os e-mails usam estas fontes fora do site (src/servidor/email/modelos.ts): sem este cabeçalho, o cliente de e-mail recusa a fonte e fica na pilha de reserva.
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};

export default config;
