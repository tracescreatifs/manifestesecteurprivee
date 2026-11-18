import { NextResponse } from "next/server";

import { cheminPdfFinal, estPdf, PDF_TAILLE_MAX } from "@/lib/document/regles";
import { exigerAdminActif } from "@/lib/session-admin";
import { creerClientAdmin } from "@/lib/supabase/admin";
import { creerClientServeur } from "@/lib/supabase/server";
import { lireManifeste } from "@/lib/texte/serveur";

/*
  PDF du document final (D25, prompt 08).
  POST : dépôt du PDF enregistré depuis l'impression du navigateur, avant la publication. Type réel vérifié
  (premiers octets « %PDF- »), taille limitée, rangé dans le bucket privé exports. La publication le rattache.
  GET : téléchargement du PDF publié par un admin, par un lien signé de courte durée.
*/
export const dynamic = "force-dynamic";

const PRIVE = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const reponse = (corps: Record<string, unknown>, status = 200) => NextResponse.json(corps, { status, headers: PRIVE });

export async function POST(requete: Request) {
  const acces = await exigerAdminActif();
  if (!acces.ok) return reponse({ erreur: acces.erreur }, 401);
  const annoncee = Number(requete.headers.get("content-length") ?? 0);
  if (annoncee > PDF_TAILLE_MAX + 64 * 1024) return reponse({ erreur: "PDF trop lourd (4 Mo au plus)." }, 413);

  const manifeste = await lireManifeste(await creerClientServeur());
  if (!manifeste) return reponse({ erreur: "Le Manifeste n'existe pas encore en base." }, 409);
  if (manifeste.statut !== "clos") return reponse({ erreur: "Le PDF se dépose quand les signatures sont closes, avant la publication." }, 409);

  const formulaire = await requete.formData().catch(() => null);
  const fichier = formulaire?.get("pdf");
  if (!(fichier instanceof Blob) || fichier.size === 0) return reponse({ erreur: "Choisissez le fichier PDF." }, 400);
  if (fichier.size > PDF_TAILLE_MAX) return reponse({ erreur: "PDF trop lourd (4 Mo au plus)." }, 400);
  const octets = new Uint8Array(await fichier.arrayBuffer());
  if (!estPdf(octets)) return reponse({ erreur: "Ce fichier n'est pas un PDF. Enregistrez le document en PDF depuis l'impression." }, 400);

  const chemin = cheminPdfFinal(new Date());
  const { error } = await creerClientAdmin()
    .storage.from("exports")
    .upload(chemin, octets, { contentType: "application/pdf", upsert: false });
  if (error) return reponse({ erreur: "Le PDF n'a pas pu être enregistré. Réessayez." }, 500);
  return reponse({ chemin, taille: fichier.size });
}

export async function GET() {
  const acces = await exigerAdminActif();
  if (!acces.ok) return reponse({ erreur: acces.erreur }, 401);
  const manifeste = await lireManifeste(await creerClientServeur());
  if (!manifeste?.pdf_final_path || manifeste.statut !== "publie") return reponse({ erreur: "Aucun document publié." }, 404);
  const { data } = await creerClientAdmin()
    .storage.from("exports")
    .createSignedUrl(manifeste.pdf_final_path, 60, { download: "Manifeste-document-final.pdf" });
  if (!data?.signedUrl) return reponse({ erreur: "Le document n'a pas pu être lu. Réessayez." }, 500);
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: PRIVE });
}
