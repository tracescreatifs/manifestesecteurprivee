/*
  Photo d'une signature manuscrite (signataires sur place, prompt 08), préparée dans le navigateur :
  - recadrage simple : autour de l'encre, avec une petite marge (et rotation d'un quart de tour si besoin) ;
  - fond blanc : le papier devient blanc, l'encre reste foncée (contraste étiré) ;
  - compression : JPEG, 1200 x 500 px au plus.
*/

const LARGEUR_MAX = 1200;
const HAUTEUR_MAX = 500;
const ANALYSE_MAX = 1600;

export type SignaturePreparee = { blob: Blob; apercu: string };

function luminance(d: Uint8ClampedArray, i: number): number {
  return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
}

export async function preparerSignature(fichier: Blob, quartsDeTour = 0): Promise<SignaturePreparee> {
  const bitmap = await createImageBitmap(fichier, { imageOrientation: "from-image" });
  /* 1. Image réduite et tournée, pour l'analyse */
  const echelle = Math.min(1, ANALYSE_MAX / Math.max(bitmap.width, bitmap.height));
  const l0 = Math.round(bitmap.width * echelle);
  const h0 = Math.round(bitmap.height * echelle);
  const tourne = quartsDeTour % 2 === 1;
  const source = document.createElement("canvas");
  source.width = tourne ? h0 : l0;
  source.height = tourne ? l0 : h0;
  const cs = source.getContext("2d", { willReadFrequently: true });
  if (!cs) throw new Error("canvas");
  cs.translate(source.width / 2, source.height / 2);
  cs.rotate((quartsDeTour * Math.PI) / 2);
  cs.drawImage(bitmap, -l0 / 2, -h0 / 2, l0, h0);
  bitmap.close();

  /* 2. Niveau du papier (luminance médiane) et de l'encre */
  const { width: L, height: H } = source;
  const pixels = cs.getImageData(0, 0, L, H);
  const d = pixels.data;
  const histogramme = new Array<number>(256).fill(0);
  for (let i = 0; i < d.length; i += 4) histogramme[Math.round(luminance(d, i))]++;
  let cumul = 0;
  let papier = 255;
  for (let v = 0; v < 256; v++) {
    cumul += histogramme[v];
    if (cumul >= (L * H) / 2) {
      papier = v;
      break;
    }
  }
  const seuil = papier * 0.72;

  /* 3. Cadre autour de l'encre (une ligne ou une colonne compte si elle contient assez d'encre) */
  const lignes = new Array<number>(H).fill(0);
  const colonnes = new Array<number>(L).fill(0);
  let encre = 255;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < L; x++) {
      const v = luminance(d, (y * L + x) * 4);
      if (v < seuil) {
        lignes[y]++;
        colonnes[x]++;
        if (v < encre) encre = v;
      }
    }
  }
  const minimum = (n: number) => Math.max(2, Math.round(n * 0.004));
  const premier = (t: number[], m: number) => t.findIndex((n) => n >= m);
  const dernier = (t: number[], m: number) => t.length - 1 - [...t].reverse().findIndex((n) => n >= m);
  let x0 = premier(colonnes, minimum(H));
  let y0 = premier(lignes, minimum(L));
  let x1 = dernier(colonnes, minimum(H));
  let y1 = dernier(lignes, minimum(L));
  if (x0 < 0 || y0 < 0 || x1 <= x0 || y1 <= y0) {
    x0 = 0;
    y0 = 0;
    x1 = L - 1;
    y1 = H - 1;
  }
  const marge = Math.round(Math.max(x1 - x0, y1 - y0) * 0.06);
  x0 = Math.max(0, x0 - marge);
  y0 = Math.max(0, y0 - marge);
  x1 = Math.min(L - 1, x1 + marge);
  y1 = Math.min(H - 1, y1 + marge);

  /* 4. Fond blanc : contraste étiré entre l'encre et le papier, en niveaux de gris */
  const etendue = Math.max(1, papier * 0.9 - encre);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((luminance(d, i) - encre) / etendue) * 255));
    const g = v > 235 ? 255 : v;
    d[i] = g;
    d[i + 1] = g;
    d[i + 2] = g;
  }
  cs.putImageData(pixels, 0, 0);

  /* 5. Recadrage et compression */
  const lc = x1 - x0 + 1;
  const hc = y1 - y0 + 1;
  const reduction = Math.min(1, LARGEUR_MAX / lc, HAUTEUR_MAX / hc);
  const sortie = document.createElement("canvas");
  sortie.width = Math.max(1, Math.round(lc * reduction));
  sortie.height = Math.max(1, Math.round(hc * reduction));
  const co = sortie.getContext("2d");
  if (!co) throw new Error("canvas");
  co.fillStyle = "#fff";
  co.fillRect(0, 0, sortie.width, sortie.height);
  co.drawImage(source, x0, y0, lc, hc, 0, 0, sortie.width, sortie.height);
  const blob = await new Promise<Blob | null>((ok) => sortie.toBlob(ok, "image/jpeg", 0.85));
  if (!blob) throw new Error("jpeg");
  return { blob, apercu: URL.createObjectURL(blob) };
}
