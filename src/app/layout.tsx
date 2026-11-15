import type { Metadata } from "next";
import type { ReactNode } from "react";

import { fontVariables } from "@/lib/fonts";

import "./globals.css";

/* Adresse publique, pour les liens absolus de l'aperçu de partage (sinon, Vercel fournit la sienne) */
function adresseDuSite(): URL | undefined {
  try {
    return process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined;
  } catch {
    return undefined;
  }
}

const TITRE = "Manifeste du secteur privé sénégalais de l'eau et de l'assainissement";
const DESCRIPTION = "Lire et signer le Manifeste présenté à Abu Dhabi";

export const metadata: Metadata = {
  metadataBase: adresseDuSite(),
  description: DESCRIPTION,
  openGraph: {
    title: TITRE,
    description: DESCRIPTION,
    type: "website",
    locale: "fr_SN",
    siteName: TITRE,
  },
  title: {
    default: TITRE,
    template: `%s · ${TITRE}`,
  },
  /* Aucune page à référencer (D29) */
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
