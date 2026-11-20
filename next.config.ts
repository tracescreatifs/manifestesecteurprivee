import type { NextConfig } from "next";

/*
  En-têtes de sécurité (audit 06b) : aucune page ne s'affiche dans un cadre d'un autre site (anti-clickjacking),
  et les liens personnels /s/... ne sont jamais transmis à un autre site par le Referer (en plus de la balise meta).
*/
const ANTI_CADRE = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: ANTI_CADRE },
      { source: "/s/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/rejoindre", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
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
