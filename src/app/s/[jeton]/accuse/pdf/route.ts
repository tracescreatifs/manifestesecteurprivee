import { accusePourSignature } from "@/lib/signature/accuse-stockage";
import { invitationDuJeton, JETON_VALIDE } from "@/lib/signature/serveur";
import { creerClientAdmin } from "@/lib/supabase/admin";

/*
  Téléchargement de l'accusé en PDF : le jeton est revalidé, puis le fichier rangé est servi
  (Accuse-MSP-2026-NNNN.pdf). Il est produit au premier téléchargement s'il n'existe pas encore.
*/

export const dynamic = "force-dynamic";

const ENTETES_PRIVES = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

export async function GET(_requete: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const introuvable = (message: string) =>
    new Response(message, { status: 404, headers: { ...ENTETES_PRIVES, "Content-Type": "text/plain; charset=utf-8" } });

  if (!JETON_VALIDE.test(jeton)) return introuvable("Ce lien n'est pas valide.");
  const invitation = await invitationDuJeton(jeton);
  if (!invitation) return introuvable("Ce lien n'est pas valide.");

  const { data: signature } = await creerClientAdmin()
    .from("signatures")
    .select("id")
    .eq("invitation_id", invitation.id)
    .is("retiree_le", null)
    .maybeSingle();
  if (!signature) return introuvable("Aucune signature pour ce lien.");

  const accuse = await accusePourSignature(signature.id);
  if (!accuse) return introuvable("Aucune signature pour ce lien.");

  return new Response(Buffer.from(accuse.octets), {
    headers: {
      ...ENTETES_PRIVES,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Accuse-${accuse.reference}.pdf"`,
      "Content-Length": String(accuse.octets.byteLength),
    },
  });
}
