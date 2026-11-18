import { NextResponse } from "next/server";

import { invitationDuJeton, JETON_VALIDE } from "@/lib/signature/serveur";
import { creerClientAdmin } from "@/lib/supabase/admin";

/*
  Document final publié (D25, prompt 08), téléchargé depuis le lien du CEO :
  le fichier PDF stocké au moment de la publication, servi par un lien signé d'une minute. Jamais régénéré.
*/
export const dynamic = "force-dynamic";

const PRIVE = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

export async function GET(_requete: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const introuvable = () => new NextResponse("Document indisponible.", { status: 404, headers: PRIVE });
  if (!JETON_VALIDE.test(jeton)) return introuvable();
  const invitation = await invitationDuJeton(jeton).catch(() => null);
  if (!invitation) return introuvable();

  const supabase = creerClientAdmin();
  const { data: manifeste } = await supabase
    .from("manifestes")
    .select("statut, pdf_final_path")
    .eq("id", invitation.manifesteId)
    .maybeSingle();
  if (!manifeste || manifeste.statut !== "publie" || !manifeste.pdf_final_path) return introuvable();

  const { data } = await supabase.storage
    .from("exports")
    .createSignedUrl(manifeste.pdf_final_path, 60, { download: "Manifeste-secteur-prive-senegalais-eau-assainissement.pdf" });
  if (!data?.signedUrl) return introuvable();
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: PRIVE });
}
