"use client";

import { File as IconeFichier, GitCompare, History, Lock, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Modal } from "@/components/ui/modal";
import { Toast, useToast } from "@/components/ui/toast";

import { restaurerVersion } from "./actions";

export type ResumeVersion = {
  numero: number;
  correctionMineure: boolean;
  signature: boolean;
  resume: string;
  fichier: string | null;
  date: string;
  auteur: string;
};

export function ListeVersions({
  versions,
  peutRestaurer,
}: {
  versions: ResumeVersion[];
  peutRestaurer: boolean;
}) {
  const { message, afficher } = useToast();
  const [enCours, demarrer] = useTransition();
  const [aRestaurer, setARestaurer] = useState<number | null>(null);
  const courante = versions[0]?.numero ?? 0;

  const confirmer = () => {
    if (aRestaurer === null) return;
    const numero = aRestaurer;
    demarrer(async () => {
      const r = await restaurerVersion({ numero });
      setARestaurer(null);
      if (!r.ok) return afficher(r.erreur, true);
      afficher(`Version ${numero} restaurée dans la version ${r.numero}`);
    });
  };

  return (
    <section className="grid gap-2.5 rounded-carte bg-surface shadow-douce p-[18px]">
      <h3 className="flex items-center gap-2 font-titre text-[17px] font-normal">
        <History aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
        Versions
      </h3>
      {versions.length === 0 ? (
        <p className="text-[14px] text-texte-secondaire">Aucune version pour l&apos;instant.</p>
      ) : (
        <ol className="grid gap-2.5 min-[1080px]:max-h-[calc(100vh-420px)] min-[1080px]:overflow-y-auto">
          {versions.map((v) => (
            <li key={v.numero} className="grid gap-1.5 rounded-controle border border-filet p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="font-titre text-[17px] font-normal">Version {v.numero}</strong>
                <span className="flex flex-wrap gap-1.5">
                  {v.signature ? (
                    <Chip variante="succes">
                      <Lock aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                      Signature
                    </Chip>
                  ) : null}
                  {v.correctionMineure ? <Chip>Correction mineure</Chip> : null}
                </span>
              </div>
              <p className="text-[13.5px] text-texte-secondaire">{v.resume}</p>
              <p className="flex items-start gap-1.5 text-[13px] text-texte-secondaire">
                <IconeFichier aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {v.fichier ? `${v.fichier}, ` : ""}
                  {v.date}, par {v.auteur}
                </span>
              </p>
              <div className="flex flex-wrap gap-x-3">
                {v.numero > 1 ? (
                  <Link
                    href={`/admin/texte/comparer?de=${v.numero - 1}&a=${v.numero}`}
                    className="inline-flex min-h-11 items-center gap-1.5 text-[13.5px] font-medium text-eau hover:underline"
                  >
                    <GitCompare aria-hidden="true" className="size-4" strokeWidth={1.75} />
                    Comparer
                  </Link>
                ) : null}
                {peutRestaurer && v.numero !== courante ? (
                  <button
                    type="button"
                    onClick={() => setARestaurer(v.numero)}
                    className="inline-flex min-h-11 items-center gap-1.5 text-[13.5px] font-medium text-eau hover:underline"
                  >
                    <RotateCcw aria-hidden="true" className="size-4" strokeWidth={1.75} />
                    Restaurer
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}

      <Modal
        ouvert={aRestaurer !== null}
        titre={`Restaurer la version ${aRestaurer ?? ""}`}
        onFermer={() => setARestaurer(null)}
        pied={
          <>
            <Button variante="discret" onClick={() => setARestaurer(null)}>
              Annuler
            </Button>
            <Button variante="principal" onClick={confirmer} disabled={enCours}>
              <RotateCcw aria-hidden="true" strokeWidth={1.75} />
              Restaurer
            </Button>
          </>
        }
      >
        <p>
          Le contenu de la version {aRestaurer} sera repris dans une nouvelle version {courante + 1}. Rien n&apos;est
          effacé. Pensez à remettre le Google Doc au même texte pour éviter un écart au prochain import.
        </p>
      </Modal>
      <Toast message={message} />
    </section>
  );
}
