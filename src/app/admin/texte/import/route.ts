import { NextResponse, type NextRequest } from "next/server";

import { exigerAdminActif } from "@/lib/session-admin";
import { creerClientServeur } from "@/lib/supabase/server";
import { ErreurLecture, lireDocx } from "@/lib/texte/lire-docx";
import {
  BUCKET_IMPORTS,
  TAILLE_MAX_OCTETS,
  TYPE_DOCX,
  cheminImport,
  lireManifeste,
  nomDeFichierSur,
} from "@/lib/texte/serveur";

/*
  Réception du fichier Word : contrôles, rangement dans le bucket privé imports,
  puis l'admin est envoyé vers l'écran « Vérifier l'import ».
  Rien n'est créé en base ici : la version n'est créée qu'après validation.
*/
export async function POST(request: NextRequest) {
  const refus = (erreur: string, statut = 400) => NextResponse.json({ ok: false, erreur }, { status: statut });

  const acces = await exigerAdminActif();
  if (!acces.ok) return refus(acces.erreur, 401);

  const supabase = await creerClientServeur();
  const manifeste = await lireManifeste(supabase);
  if (!manifeste) return refus("Le Manifeste n'existe pas encore en base : exécutez les données de départ.", 409);
  if (manifeste.statut !== "redaction" && manifeste.statut !== "gele") {
    return refus("Les signatures sont closes : le texte ne peut plus être modifié.", 409);
  }

  let fichier: FormDataEntryValue | null;
  try {
    fichier = (await request.formData()).get("fichier");
  } catch {
    return refus("Le fichier n'a pas pu être reçu. Réessayez.");
  }
  if (!fichier || typeof fichier === "string") return refus("Choisissez un fichier Word (.docx).");

  const nom = fichier.name || "texte.docx";
  if (/\.doc$/i.test(nom)) return refus("Ce fichier est au format .doc : enregistrez le fichier au format .docx.");
  if (!/\.docx$/i.test(nom)) return refus("Choisissez un fichier Word (.docx) téléchargé depuis le Google Doc.");
  if (fichier.size > TAILLE_MAX_OCTETS) return refus("Le fichier dépasse 5 Mo. Un texte du Manifeste pèse bien moins : vérifiez le fichier.");
  if (fichier.size === 0) return refus("Le fichier est vide.");

  const octets = new Uint8Array(await fichier.arrayBuffer());
  /* Un .docx est une archive zip : il commence par « PK » */
  if (octets[0] !== 0x50 || octets[1] !== 0x4b) {
    return refus("Ce fichier n'est pas un document Word valide. Retéléchargez-le depuis le Google Doc (Fichier, Télécharger, Microsoft Word).");
  }
  try {
    lireDocx(octets);
  } catch (e) {
    return refus(e instanceof ErreurLecture ? e.message : "Ce fichier n'a pas pu être lu.");
  }

  const id = crypto.randomUUID();
  const { error } = await supabase.storage
    .from(BUCKET_IMPORTS)
    .upload(cheminImport(id, nomDeFichierSur(nom)), octets, { contentType: TYPE_DOCX, upsert: false });
  if (error) return refus("Le fichier n'a pas pu être enregistré. Réessayez.", 500);

  return NextResponse.json({ ok: true, id });
}
