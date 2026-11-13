import type { MetadataRoute } from "next";

/* Aucune page à référencer : tout est interdit à tous les robots (D29) */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
