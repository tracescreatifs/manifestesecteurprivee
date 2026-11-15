import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

/*
  Image d'aperçu quand un lien du site est partagé (WhatsApp notamment).
  WhatsApp la recadre en carré au centre : l'essentiel tient dans le carré central de 630 x 630
  (la goutte, « Manifeste » en Fraunces, le filet or, « Abu Dhabi, décembre 2026 »).
  Le titre complet reste dans les métadonnées (texte alternatif, og:title).
*/
export const alt = "Manifeste du secteur privé sénégalais de l'eau et de l'assainissement";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ImageApercu() {
  const [fraunces, jost] = await Promise.all([
    readFile(join(process.cwd(), "src/assets/polices/Fraunces-Regular-sous-ensemble.ttf")),
    readFile(join(process.cwd(), "src/assets/polices/Jost-Regular-sous-ensemble.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F7F3EA",
        }}
      >
        <div
          style={{
            width: 630,
            height: 630,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 20,
              background: "#1D4E5C",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Goutte de la marque (icône lucide « droplets ») */}
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" />
              <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" />
            </svg>
          </div>
          <div style={{ marginTop: 36, fontFamily: "Fraunces", fontSize: 108, lineHeight: 1, color: "#14212B", letterSpacing: -1 }}>
            Manifeste
          </div>
          <div style={{ marginTop: 36, width: 140, height: 4, background: "#C2A14D" }} />
          <div style={{ marginTop: 30, fontFamily: "Jost", fontSize: 32, color: "#5B6670" }}>Abu Dhabi, décembre 2026</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Fraunces", data: fraunces, style: "normal", weight: 400 },
        { name: "Jost", data: jost, style: "normal", weight: 400 },
      ],
    },
  );
}
