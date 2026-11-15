import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Polices intégrées à l'accusé PDF, lues à l'exécution par les fonctions de l'espace CEO (D74) */
  outputFileTracingIncludes: {
    "/s/**": ["./src/assets/polices/*-latin.ttf"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
