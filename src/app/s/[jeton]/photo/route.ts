import { randomUUID } from "node:crypto";

import { PHOTO_TAILLE_MAX, TEXTES_CHOIX } from "@/lib/signature/fiche";
import { invitationDuJeton, JETON_VALIDE, lireChoix } from "@/lib/signature/serveur";
import { creerClientAdmin } from "@/lib/supabase/admin";

/*
  Photo de la fiche du CEO : carré de 400 px en JPEG, préparé dans le navigateur.
  POST ajoute ou remplace la photo, DELETE la retire. Le jeton est revalidé à chaque appel,
  et la photo n'est possible qu'après la signature. Bucket privé « photos », chemin dans personnes.photo_path.
*/

export const dynamic = "force-dynamic";

const reponse = (corps: Record<string, unknown>, status = 200) =>
  Response.json(corps, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });

async function cible(jeton: string) {
  if (!JETON_VALIDE.test(jeton)) return null;
  const invitation = await invitationDuJeton(jeton);
  if (!invitation?.personneId) return null;
  const { count } = await creerClientAdmin()
    .from("signatures")
    .select("id", { count: "exact", head: true })
    .eq("invitation_id", invitation.id)
    .is("retiree_le", null);
  return (count ?? 0) > 0 ? invitation : null;
}

export async function POST(requete: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const invitation = await cible(jeton);
  if (!invitation) return reponse({ erreur: "La photo est possible après votre signature." }, 403);

  const formulaire = await requete.formData().catch(() => null);
  const fichier = formulaire?.get("photo");
  if (!(fichier instanceof Blob) || fichier.size === 0) return reponse({ erreur: "Choisissez une photo." }, 400);
  if (fichier.size > PHOTO_TAILLE_MAX) return reponse({ erreur: "Photo trop lourde. Choisissez-en une autre." }, 400);
  const octets = new Uint8Array(await fichier.arrayBuffer());
  /* Seul un JPEG est accepté (signature du format : FF D8 FF) */
  if (octets[0] !== 0xff || octets[1] !== 0xd8 || octets[2] !== 0xff) {
    return reponse({ erreur: "Ce fichier n'est pas une photo valide." }, 400);
  }

  const supabase = creerClientAdmin();
  const chemin = `${invitation.personneId}/${randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("photos").upload(chemin, octets, { contentType: "image/jpeg", upsert: false });
  if (error) return reponse({ erreur: "La photo n'a pas pu être enregistrée. Réessayez." }, 500);
  await supabase.from("personnes").update({ photo_path: chemin }).eq("id", invitation.personneId as string);
  if (invitation.photoPath) await supabase.storage.from("photos").remove([invitation.photoPath]);

  const { data } = await supabase.storage.from("photos").createSignedUrl(chemin, 3600);
  return reponse({ url: data?.signedUrl ?? null });
}

export async function DELETE(_requete: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const invitation = await cible(jeton);
  if (!invitation) return reponse({ erreur: "Ce lien n'est pas valide." }, 403);

  const supabase = creerClientAdmin();
  await supabase.from("personnes").update({ photo_path: null }).eq("id", invitation.personneId as string);
  if (invitation.photoPath) await supabase.storage.from("photos").remove([invitation.photoPath]);

  /* Sans photo, l'accord pour la communication tombe : une ligne de retrait est ajoutée */
  const choix = await lireChoix(invitation.personneId);
  if (choix.photo_communication) {
    await supabase.from("consentements").insert({
      personne_id: invitation.personneId as string,
      type: "photo_communication",
      accorde: false,
      texte: TEXTES_CHOIX.photo_communication,
      source: "fiche",
    });
  }
  return reponse({ ok: true });
}
