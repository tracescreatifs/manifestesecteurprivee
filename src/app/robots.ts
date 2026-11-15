import type { MetadataRoute } from "next";

/*
  Aucune page à référencer (D29) : tout est interdit aux robots d'indexation.
  Exception (D58) : les robots d'aperçu de lien de WhatsApp et de Facebook peuvent lire les pages,
  pour afficher le titre et l'image quand un lien est partagé. La balise noindex reste sur tout le site.
*/
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: ["WhatsApp", "facebookexternalhit", "Facebot"], allow: "/" },
      { userAgent: "*", disallow: "/" },
    ],
  };
}
