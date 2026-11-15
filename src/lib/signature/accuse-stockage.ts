import "server-only";

import { estTrace } from "@/lib/ceo/serveur";
import { creerClientAdmin } from "@/lib/supabase/admin";

import { genererAccusePdf } from "./accuse-pdf";

/*
  Accusé de signature rangé dans le bucket privé « accuses » (D74) : un fichier par référence,
  produit une seule fois (à la signature, ou au premier téléchargement pour une signature plus ancienne),
  puis toujours servi tel quel. Accès par le serveur seulement.
*/

const BUCKET = "accuses";

export async function accusePourSignature(signatureId: string): Promise<{ reference: string; octets: Uint8Array } | null> {
  const supabase = creerClientAdmin();
  const { data: s } = await supabase
    .from("signatures")
    .select(
      "reference, signe_le, prenom, nom, fonction, entreprise_nom, maillon_libelle, trace, texte_consentement, version:manifeste_versions(numero, titre)",
    )
    .eq("id", signatureId)
    .maybeSingle();
  if (!s) return null;
  const chemin = `${s.reference}.pdf`;

  const { data: existant } = await supabase.storage.from(BUCKET).download(chemin);
  if (existant) return { reference: s.reference, octets: new Uint8Array(await existant.arrayBuffer()) };

  const version = s.version as unknown as { numero: number; titre: string } | null;
  const octets = await genererAccusePdf({
    reference: s.reference,
    signeLe: s.signe_le,
    version: version?.numero ?? 0,
    titre: version?.titre ?? "",
    prenom: s.prenom ?? "",
    nom: s.nom ?? "",
    fonction: s.fonction ?? "",
    entreprise: s.entreprise_nom ?? "",
    maillon: s.maillon_libelle ?? "",
    trace: estTrace(s.trace) ? s.trace : null,
    texteConsentement: s.texte_consentement ?? "",
  });
  /* Jamais remplacé : si un autre envoi l'a rangé entre-temps, c'est ce fichier qui fait foi */
  const { error } = await supabase.storage.from(BUCKET).upload(chemin, octets, { contentType: "application/pdf", upsert: false });
  if (error) {
    const { data: range } = await supabase.storage.from(BUCKET).download(chemin);
    if (range) return { reference: s.reference, octets: new Uint8Array(await range.arrayBuffer()) };
  }
  return { reference: s.reference, octets };
}

/* Produit et range l'accusé juste après la signature (sans retarder la réponse au CEO) */
export async function rangerAccuse(reference: string): Promise<void> {
  const { data } = await creerClientAdmin().from("signatures").select("id").eq("reference", reference).maybeSingle();
  if (data) await accusePourSignature(data.id);
}
