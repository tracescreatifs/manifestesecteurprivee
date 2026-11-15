import { AlertTriangle, CheckCircle2, GitCompare, Info, OctagonAlert, ScanLine } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Comparaison } from "@/components/document/comparaison";
import { DocumentA4 } from "@/components/document/document-a4";
import { Chip } from "@/components/ui/chip";
import { exigerSessionAdmin } from "@/lib/session-admin";
import { creerClientServeur } from "@/lib/supabase/server";
import { ErreurLecture, type Avertissement } from "@/lib/texte/lire-docx";
import { analyserImport, lireManifeste, type AnalyseImport } from "@/lib/texte/serveur";

import { ActionsVerification } from "./actions-verification";

export const metadata: Metadata = { title: "Vérifier l'import" };

const STYLES_AVERTISSEMENT = {
  bloquant: { classe: "bg-erreur-doux text-[#7a2a1d]", Icone: OctagonAlert, nom: "Bloquant" },
  attention: { classe: "bg-argile-doux text-[#6d3818]", Icone: AlertTriangle, nom: "À vérifier" },
  info: { classe: "bg-sureleve text-encre", Icone: Info, nom: "Information" },
} as const;

function LigneAvertissement({ a }: { a: Avertissement }) {
  const { classe, Icone, nom } = STYLES_AVERTISSEMENT[a.niveau];
  return (
    <li className={`flex items-start gap-2.5 rounded-[10px] px-3 py-2.5 text-[14px] ${classe}`}>
      <Icone aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" strokeWidth={1.75} />
      <span>
        <span className="sr-only">{nom} : </span>
        {a.message}
      </span>
    </li>
  );
}

export default async function PageVerifier({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigerSessionAdmin();
  const { f } = await searchParams;
  if (typeof f !== "string") redirect("/admin/texte");

  const supabase = await creerClientServeur();
  const manifeste = await lireManifeste(supabase);
  if (!manifeste) redirect("/admin/texte");

  let analyse: AnalyseImport | null = null;
  let erreur: string | null = null;
  try {
    analyse = await analyserImport(supabase, manifeste, f);
  } catch (e) {
    erreur = e instanceof ErreurLecture ? e.message : "Ce fichier n'a pas pu être lu.";
  }
  if (!analyse) {
    return (
      <div className="grid max-w-[640px] gap-3">
        <h2 className="font-titre text-[22px] font-normal">Vérifier l&apos;import</h2>
        <p role="alert" className="text-erreur">
          {erreur ?? "Cet import est introuvable (déjà validé ou annulé). Déposez à nouveau le fichier depuis la rubrique Texte."}
        </p>
      </div>
    );
  }

  const gele = manifeste.statut === "gele";
  const modifiable = manifeste.statut === "redaction" || gele;
  const courante = analyse.courante;
  const identique = Boolean(courante && analyse.resume.identique);
  const numero = (courante?.numero ?? 0) + 1;

  const compte = (type: string) => analyse.blocs.filter((b) => b.type === type).length;
  const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
  const reconnu = [
    analyse.titre ? "Titre" : null,
    analyse.sousTitre ? "Sous-titre" : null,
    pluriel(compte("h"), "intertitre", "intertitres"),
    pluriel(compte("li"), "point numéroté", "points numérotés"),
    pluriel(compte("p"), "paragraphe", "paragraphes"),
    compte("accroche") ? "Accroche" : null,
    compte("mention") ? "Mention" : null,
  ].filter((x): x is string => x !== null);

  let raisonBlocage: string | null = null;
  if (!modifiable) raisonBlocage = "Les signatures sont closes : le texte ne peut plus être modifié.";
  else if (analyse.bloquant) raisonBlocage = "Corrigez d'abord le problème bloquant dans le Google Doc, puis importez à nouveau le fichier.";
  else if (identique) raisonBlocage = `Aucune modification par rapport à la version ${courante?.numero}.`;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-titre text-[22px] font-normal tracking-[-0.01em]">Vérifier l&apos;import</h2>
          <p className="mt-1 text-texte-secondaire">
            <span className="break-all">{analyse.nom}</span>. Rien n&apos;est remplacé tant que vous n&apos;avez pas
            validé.
          </p>
        </div>
      </div>

      <div className="grid items-start gap-6 min-[1080px]:grid-cols-[minmax(0,1fr)_340px]">
        <DocumentA4
          titre={analyse.titre || courante?.titre || ""}
          sousTitre={analyse.sousTitre}
          blocs={analyse.blocs}
          brouillon={manifeste.statut === "redaction"}
          libelle="Aperçu"
        />

        <div className="grid gap-4 min-[1080px]:sticky min-[1080px]:top-24">
          <section className="grid gap-3.5 rounded-[14px] border border-filet bg-surface p-[18px]">
            <h3 className="flex items-center gap-2 font-titre text-[17px] font-normal">
              <ScanLine aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
              Ce qui a été reconnu
            </h3>
            <div className="flex flex-wrap gap-2">
              {reconnu.map((r) => (
                <Chip key={r}>{r}</Chip>
              ))}
            </div>

            <h3 className="flex items-center gap-2 font-titre text-[17px] font-normal">
              <GitCompare aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
              {courante ? `Changements par rapport à la version ${courante.numero}` : "Première version"}
            </h3>
            <p className="text-[14px]">{analyse.resume.texte}</p>
            {courante && !identique ? (
              <a href="#detail" className="inline-flex min-h-11 items-center text-[13.5px] font-medium text-eau hover:underline">
                Voir le détail mot à mot
              </a>
            ) : null}

            <h3 className="flex items-center gap-2 font-titre text-[17px] font-normal">
              <AlertTriangle aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />À vérifier
            </h3>
            {analyse.avertissements.length ? (
              <ul className="grid gap-2">
                {analyse.avertissements.map((a, i) => (
                  <LigneAvertissement key={i} a={a} />
                ))}
              </ul>
            ) : (
              <p className="flex items-start gap-2.5 rounded-[10px] bg-sureleve px-3 py-2.5 text-[14px]">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" strokeWidth={1.75} />
                Aucun problème détecté.
              </p>
            )}

            <ActionsVerification
              fichier={analyse.id}
              numero={numero}
              gele={gele}
              raisonBlocage={raisonBlocage}
            />
          </section>
        </div>
      </div>

      {courante && !identique ? (
        <section id="detail" className="mt-8 grid max-w-[840px] scroll-mt-24 gap-3">
          <h3 className="font-titre text-xl font-normal">Détail des changements</h3>
          <Comparaison
            operations={analyse.operations}
            titre={{ avant: courante.titre, apres: analyse.titre }}
            sousTitre={{ avant: courante.sous_titre ?? "", apres: analyse.sousTitre }}
          />
        </section>
      ) : null}
    </>
  );
}
