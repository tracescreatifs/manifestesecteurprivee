import { Fragment } from "react";

import { diffMots, type Operation } from "@/lib/texte/comparer";
import { texteBrut } from "@/lib/texte/html";
import type { Bloc } from "@/types/database";

/*
  Comparaison de deux versions, bloc par bloc : ajouté, supprimé, modifié
  (avec les mots changés mis en évidence). Les blocs inchangés consécutifs sont regroupés.
*/

const NOMS: Record<Bloc["type"], string> = {
  titre: "Titre",
  sous: "Sous-titre",
  h: "Intertitre",
  accroche: "Accroche",
  mention: "Mention",
  p: "Paragraphe",
  li: "Point numéroté",
};

type Props = {
  operations: Operation[];
  titre?: { avant: string; apres: string };
  sousTitre?: { avant: string; apres: string };
};

type Groupe = { inchanges: number } | { operation: Exclude<Operation, { statut: "egal" }> };

function Etiquette({ type, statut }: { type: Bloc["type"]; statut: string }) {
  return (
    <p className="text-[12.5px] font-medium text-texte-secondaire">
      {NOMS[type]} {statut}
      {type === "accroche" || type === "mention" ? "e" : ""}
    </p>
  );
}

function DiffTexte({ avant, apres }: { avant: string; apres: string }) {
  if (avant === apres) {
    return (
      <p className="leading-relaxed">
        {apres} <span className="text-[13px] text-texte-secondaire">(seule la mise en forme a changé)</span>
      </p>
    );
  }
  return (
    <p className="leading-relaxed">
      {diffMots(avant, apres).map((m, i) => (
        <Fragment key={i}>
          {m.statut === "egal" ? (
            m.texte
          ) : m.statut === "ajoute" ? (
            <ins className="rounded-[3px] bg-succes-doux px-0.5 text-succes no-underline">{m.texte}</ins>
          ) : (
            <del className="rounded-[3px] bg-erreur-doux px-0.5 text-erreur">{m.texte}</del>
          )}{" "}
        </Fragment>
      ))}
    </p>
  );
}

export function Comparaison({ operations, titre, sousTitre }: Props) {
  const groupes: Groupe[] = [];
  for (const op of operations) {
    if (op.statut === "egal") {
      const dernier = groupes[groupes.length - 1];
      if (dernier && "inchanges" in dernier) dernier.inchanges++;
      else groupes.push({ inchanges: 1 });
    } else {
      groupes.push({ operation: op });
    }
  }

  const changementsEntete = [
    titre && titre.avant !== titre.apres ? { nom: "Titre", ...titre } : null,
    sousTitre && sousTitre.avant !== sousTitre.apres ? { nom: "Sous-titre", ...sousTitre } : null,
  ].filter((x): x is { nom: string; avant: string; apres: string } => x !== null);

  return (
    <ol className="grid gap-2 text-[15px]">
      {changementsEntete.map((c) => (
        <li key={c.nom} className="grid gap-1 rounded-controle border border-filet bg-surface p-3">
          <p className="text-[12.5px] font-medium text-texte-secondaire">{c.nom} modifié</p>
          <DiffTexte avant={c.avant.replace(/\n/g, " ")} apres={c.apres.replace(/\n/g, " ")} />
        </li>
      ))}
      {groupes.map((g, i) => {
        if ("inchanges" in g) {
          return (
            <li key={i} className="px-3 py-1 text-[13px] text-texte-secondaire">
              {g.inchanges} {g.inchanges > 1 ? "paragraphes inchangés" : "paragraphe inchangé"}
            </li>
          );
        }
        const op = g.operation;
        if (op.statut === "ajoute") {
          return (
            <li key={i} className="grid gap-1 rounded-controle bg-succes-doux p-3 text-[#1d4d35]">
              <Etiquette type={op.apres.type} statut="ajouté" />
              <p>{texteBrut(op.apres.html)}</p>
            </li>
          );
        }
        if (op.statut === "supprime") {
          return (
            <li key={i} className="grid gap-1 rounded-controle bg-erreur-doux p-3 text-[#7a2a1d]">
              <Etiquette type={op.avant.type} statut="supprimé" />
              <p className="line-through">{texteBrut(op.avant.html)}</p>
            </li>
          );
        }
        return (
          <li key={i} className="grid gap-1 rounded-controle border border-filet bg-surface p-3">
            <Etiquette type={op.apres.type} statut="modifié" />
            <DiffTexte avant={texteBrut(op.avant.html)} apres={texteBrut(op.apres.html)} />
          </li>
        );
      })}
    </ol>
  );
}
