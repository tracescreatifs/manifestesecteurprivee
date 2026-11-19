import { Fragment, type ReactNode } from "react";

import { analyserMessage } from "@/lib/ceo/mise-en-forme";

/*
  Aperçu d'un message tel que WhatsApp l'affiche : gras, italique, sauts de ligne respectés, lien en clair.
  Rendu en éléments React uniquement (aucun HTML injecté).
*/
export function ApercuWhatsApp({
  message,
  etiquette,
  fond = "sureleve",
}: {
  message: string;
  etiquette?: string;
  /* « surface » : sur un fond coloré (bandeau de validation) */
  fond?: "sureleve" | "surface";
}) {
  const lignes = analyserMessage(message);
  return (
    <div
      className={
        "relative rounded-controle p-3 text-[14px] leading-[1.45] whitespace-pre-wrap text-encre [overflow-wrap:anywhere] " +
        (fond === "surface" ? "bg-surface " : "bg-sureleve ") +
        (etiquette ? "pt-8" : "")
      }
    >
      {etiquette ? (
        <span className="absolute top-2 left-3 rounded-md bg-[#ECECEA] px-2 py-0.5 text-[12px] font-medium whitespace-normal text-encre">
          {etiquette}
        </span>
      ) : null}
      {lignes.map((morceaux, i) => (
        <Fragment key={i}>
          {i > 0 ? "\n" : null}
          {morceaux.map((m, j) => {
            if (m.lien) {
              return (
                <span key={j} className="text-eau underline underline-offset-2">
                  {m.texte}
                </span>
              );
            }
            let contenu: ReactNode = m.texte;
            if (m.italique) contenu = <em>{contenu}</em>;
            if (m.gras) contenu = <strong className="font-semibold">{contenu}</strong>;
            return <Fragment key={j}>{contenu}</Fragment>;
          })}
        </Fragment>
      ))}
    </div>
  );
}
