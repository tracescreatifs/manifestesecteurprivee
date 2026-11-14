import type { Metadata } from "next";
import type { ReactNode } from "react";

import { fontVariables } from "@/lib/fonts";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Manifeste du secteur privé sénégalais de l'eau et de l'assainissement",
    template: "%s · Manifeste du secteur privé sénégalais de l'eau et de l'assainissement",
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
