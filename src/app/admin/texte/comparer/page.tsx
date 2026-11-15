import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Comparaison } from "@/components/document/comparaison";
import { classesBouton } from "@/components/ui/button";
import { exigerSessionAdmin } from "@/lib/session-admin";
import { creerClientServeur } from "@/lib/supabase/server";
import { aligner } from "@/lib/texte/comparer";
import { lireManifeste, lireVersions } from "@/lib/texte/serveur";

export const metadata: Metadata = { title: "Comparer deux versions" };

export default async function PageComparer({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigerSessionAdmin();
  const supabase = await creerClientServeur();
  const manifeste = await lireManifeste(supabase);
  if (!manifeste) redirect("/admin/texte");

  const versions = await lireVersions(supabase, manifeste.id);
  if (versions.length < 2) redirect("/admin/texte");

  const parametres = await searchParams;
  const lire = (v: string | string[] | undefined, defaut: number) => {
    const n = Number(typeof v === "string" ? v : NaN);
    return versions.some((x) => x.numero === n) ? n : defaut;
  };
  const de = lire(parametres.de, versions[1].numero);
  const a = lire(parametres.a, versions[0].numero);
  const avant = versions.find((v) => v.numero === de)!;
  const apres = versions.find((v) => v.numero === a)!;

  const { operations, resume } = aligner(
    { titre: avant.titre, sousTitre: avant.sous_titre ?? "", blocs: avant.blocs },
    { titre: apres.titre, sousTitre: apres.sous_titre ?? "", blocs: apres.blocs },
  );

  const choix = (nom: string, valeur: number, libelle: string) => (
    <label className="inline-flex items-center gap-2 text-[14px] text-texte-secondaire">
      {libelle}
      <select
        name={nom}
        defaultValue={valeur}
        className="min-h-11 rounded-[10px] border border-filet-fort bg-surface px-3 text-base text-encre"
      >
        {versions.map((v) => (
          <option key={v.numero} value={v.numero}>
            {v.numero}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      <div className="mb-4 grid gap-2">
        <Link
          href="/admin/texte"
          className="inline-flex min-h-11 items-center gap-1.5 justify-self-start text-[14px] font-medium text-eau hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
          Retour au texte
        </Link>
        <h2 className="font-titre text-[22px] font-normal tracking-[-0.01em]">Comparer deux versions</h2>
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-center gap-3">
        {choix("de", de, "De la version")}
        {choix("a", a, "à la version")}
        <button type="submit" className={classesBouton("secondaire")}>
          Comparer
        </button>
      </form>

      <div className="grid max-w-[840px] gap-3">
        <p className="text-[14px] text-texte-secondaire">{de === a ? "Les deux versions sont identiques." : resume.texte}</p>
        {de !== a ? (
          <Comparaison
            operations={operations}
            titre={{ avant: avant.titre, apres: apres.titre }}
            sousTitre={{ avant: avant.sous_titre ?? "", apres: apres.sous_titre ?? "" }}
          />
        ) : null}
      </div>
    </>
  );
}
