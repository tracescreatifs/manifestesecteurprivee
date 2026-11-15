import { CircleSlash, ExternalLink } from "lucide-react";
import type { Metadata } from "next";

import { DocumentA4 } from "@/components/document/document-a4";
import { classesBouton } from "@/components/ui/button";
import { formaterDateHeure } from "@/lib/dates";
import { exigerSessionAdmin } from "@/lib/session-admin";
import { creerClientServeur } from "@/lib/supabase/server";
import { lienDejaEnvoye, lireManifeste, lireVersions } from "@/lib/texte/serveur";

import { BandeauGel } from "./bandeau-gel";
import { ListeVersions, type ResumeVersion } from "./liste-versions";
import { ZoneDepot } from "./zone-depot";

export const metadata: Metadata = { title: "Texte" };

export default async function PageTexte() {
  await exigerSessionAdmin();
  const supabase = await creerClientServeur();
  const manifeste = await lireManifeste(supabase);

  if (!manifeste) {
    return (
      <p role="alert" className="text-erreur">
        Le Manifeste n&apos;existe pas encore en base : exécutez supabase/seed/0001_referentiels.sql.
      </p>
    );
  }

  const [versions, { data: admins }] = await Promise.all([
    lireVersions(supabase, manifeste.id),
    supabase.from("admins").select("user_id, prenom, nom"),
  ]);
  const noms = new Map((admins ?? []).map((a) => [a.user_id, `${a.prenom} ${a.nom}`]));
  const statut = manifeste.statut;
  const courante = versions[0] ?? null;
  const gelee = versions.find((v) => v.id === manifeste.version_gelee_id) ?? null;
  const peutImporter = statut === "redaction" || statut === "gele";
  const peutRevenir = statut === "gele" && !(await lienDejaEnvoye(supabase, manifeste.id));

  const lignes: ResumeVersion[] = versions.map((v) => ({
    numero: v.numero,
    correctionMineure: v.type === "correction_mineure",
    signature: v.id === manifeste.version_gelee_id,
    resume: v.resume?.texte ?? "",
    fichier: v.fichier_source_path ? (v.fichier_source_path.split("/").pop() ?? null) : null,
    date: formaterDateHeure(v.cree_le),
    auteur: (v.cree_par && noms.get(v.cree_par)) || "un admin",
  }));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-titre text-[22px] font-normal tracking-[-0.01em]">Texte</h2>
          <p className="mt-1 max-w-[64ch] text-texte-secondaire">
            Le texte s&apos;écrit dans le Google Doc partagé. Quand les rédacteurs ont terminé, téléchargez-le en Word
            et importez-le ici : la plateforme applique la mise en page A4.
          </p>
        </div>
        {manifeste.google_doc_url ? (
          <a
            href={manifeste.google_doc_url}
            target="_blank"
            rel="noopener noreferrer"
            className={classesBouton("secondaire")}
          >
            <ExternalLink aria-hidden="true" strokeWidth={1.75} />
            Ouvrir le Google Doc
          </a>
        ) : null}
      </div>

      {statut === "gele" && manifeste.gele_le ? (
        <BandeauGel geleLe={formaterDateHeure(manifeste.gele_le)} numero={gelee?.numero ?? null} peutRevenir={peutRevenir} />
      ) : null}
      {statut === "clos" || statut === "publie" ? (
        <div className="mb-4 flex items-start gap-3 rounded-[10px] bg-sureleve px-4 py-3 text-[14.5px]">
          <CircleSlash aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" strokeWidth={1.75} />
          <p>{statut === "publie" ? "Document publié." : "Signatures closes."} Le texte ne peut plus être modifié.</p>
        </div>
      ) : null}

      {courante ? (
        <div className="grid items-start gap-6 min-[1080px]:grid-cols-[minmax(0,1fr)_340px]">
          <DocumentA4
            titre={courante.titre}
            sousTitre={courante.sous_titre ?? ""}
            blocs={courante.blocs}
            brouillon={statut === "redaction"}
            libelle={`Version ${courante.numero}, du ${formaterDateHeure(courante.cree_le)}, par ${(courante.cree_par && noms.get(courante.cree_par)) || "un admin"}`}
          />
          <div className="grid gap-4 min-[1080px]:sticky min-[1080px]:top-24">
            {peutImporter ? (
              <ZoneDepot titre={statut === "redaction" ? "Importer une nouvelle version" : "Importer une correction mineure"} />
            ) : null}
            <ListeVersions versions={lignes} peutRestaurer={statut === "redaction"} />
          </div>
        </div>
      ) : (
        <div className="grid max-w-[640px] gap-4">
          <div className="grid gap-2 rounded-[14px] border border-filet bg-surface p-6">
            <h3 className="font-titre text-xl font-normal">Aucune version pour l&apos;instant</h3>
            <ol className="grid list-decimal gap-1 pl-5 text-texte-secondaire">
              <li>Dans le Google Doc, ouvrez le menu Fichier, puis Télécharger, puis Microsoft Word (.docx).</li>
              <li>Déposez le fichier ci-dessous : la plateforme montre ce qu&apos;elle a reconnu avant de créer la version 1.</li>
            </ol>
          </div>
          {peutImporter ? <ZoneDepot titre="Importer la première version" /> : null}
        </div>
      )}
    </>
  );
}
