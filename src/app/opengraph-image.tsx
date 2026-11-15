import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

/*
  Image d'aperçu quand un lien du site est partagé (WhatsApp notamment) :
  fond papier, titre du Manifeste en Fraunces, sous-titre, filet or.
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
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#F7F3EA",
          padding: "72px 96px",
        }}
      >
        <div
          style={{
            fontFamily: "Fraunces",
            fontSize: 56,
            lineHeight: 1.15,
            color: "#14212B",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <span>Manifeste du secteur privé sénégalais</span>
          <span>de l&apos;eau et de l&apos;assainissement</span>
        </div>
        <div style={{ marginTop: 28, fontFamily: "Jost", fontSize: 30, color: "#5B6670" }}>
          Conférence des Nations Unies sur l&apos;eau · Abu Dhabi, décembre 2026
        </div>
        <div style={{ marginTop: 40, width: 160, height: 4, background: "#C2A14D" }} />
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
