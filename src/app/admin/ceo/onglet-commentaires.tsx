"use client";

import { AlertTriangle, Save } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Modal } from "@/components/ui/modal";
import { Toast, useToast } from "@/components/ui/toast";
import { formaterDateHeure } from "@/lib/dates";
import { texteBrut } from "@/lib/texte/html";
import { avertirIntegration, LIBELLES_STATUTS_COMMENTAIRE, regrouperCommentaires } from "@/lib/verification/regles";
import type { CommentaireAdmin } from "@/lib/verification/serveur";
import type { Bloc, StatutCommentaire, StatutManifeste } from "@/types/database";

import { traiterCommentaire } from "./actions-verification";

/*
  Onglet « Commentaires » (prototype 1-admin.html, cahier des charges 6.5) : commentaires des CEO regroupés
  par paragraphe, statut et note interne. Rien de tout cela n'est visible par les CEO.
*/

const STATUTS = Object.keys(LIBELLES_STATUTS_COMMENTAIRE) as StatutCommentaire[];
const extrait = (t: string, n = 160) => (t.length > n ? `${t.slice(0, n).trim()}…` : t);

export function OngletCommentaires({
  commentaires,
  blocs,
  statutManifeste,
}: {
  commentaires: CommentaireAdmin[];
  blocs: Bloc[];
  statutManifeste: StatutManifeste;
}) {
  const { message, afficher } = useToast();
  const [enCours, demarrer] = useTransition();
  const [filtre, setFiltre] = useState<"tous" | StatutCommentaire>("tous");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [integration, setIntegration] = useState<CommentaireAdmin | null>(null);

  const visibles = useMemo(
    () => commentaires.filter((c) => filtre === "tous" || c.statut === filtre),
    [commentaires, filtre],
  );
  const groupes = useMemo(() => regrouperCommentaires(visibles, blocs), [visibles, blocs]);
  const compte = (f: "tous" | StatutCommentaire) => (f === "tous" ? commentaires.length : commentaires.filter((c) => c.statut === f).length);
  const note = (c: CommentaireAdmin) => notes[c.id] ?? c.note;

  const enregistrer = (c: CommentaireAdmin, statut: StatutCommentaire, texteNote: string, confirmation: string) => {
    demarrer(async () => {
      const r = await traiterCommentaire({ commentaireId: c.id, statut, note: texteNote });
      if (!r.ok) return afficher(r.erreur);
      setIntegration(null);
      setNotes((n) => {
        const suite = { ...n };
        delete suite[c.id];
        return suite;
      });
      afficher(confirmation);
    });
  };

  const changerStatut = (c: CommentaireAdmin, statut: StatutCommentaire) => {
    if (statut === c.statut) return;
    if (avertirIntegration(statut, statutManifeste)) return setIntegration(c);
    enregistrer(c, statut, note(c), `Commentaire : ${LIBELLES_STATUTS_COMMENTAIRE[statut]}`);
  };

  return (
    <div className="grid gap-4">
      <p className="max-w-[80ch] text-texte-secondaire">
        Commentaires laissés par les CEO sur le texte, visibles uniquement par les admins. Ce qui touche au fond va dans la
        suite de la démarche, pas dans le texte signé.
      </p>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par statut">
        {(["tous", ...STATUTS] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filtre === f}
            onClick={() => setFiltre(f)}
            className={
              "min-h-11 rounded-full border px-3 text-[13.5px] font-medium " +
              (filtre === f ? "border-encre bg-encre text-white" : "border-filet-fort bg-surface text-texte-secondaire")
            }
          >
            {f === "tous" ? "Tous" : f === "retenu" ? "Retenus pour la suite" : f === "integre" ? "Intégrés" : f === "non_retenu" ? "Non retenus" : "Nouveaux"}{" "}
            <span className="tabular-nums">{compte(f)}</span>
          </button>
        ))}
      </div>

      {groupes.length === 0 ? (
        <p className="rounded-xl border border-filet bg-surface px-4 py-7 text-center text-texte-secondaire">
          {statutManifeste === "redaction"
            ? "Les commentaires des CEO arriveront après l'envoi des liens."
            : "Aucun commentaire dans cette catégorie."}
        </p>
      ) : (
        groupes.map((g) => {
          const bloc = g.blocId ? blocs.find((b) => b.id === g.blocId) : null;
          const ancien = g.blocId && !bloc ? g.commentaires.find((c) => c.extraitVersion)?.extraitVersion : null;
          return (
            <section
              key={g.blocId ?? "general"}
              aria-label={bloc ? `Paragraphe : ${extrait(texteBrut(bloc.html), 60)}` : "Commentaire général"}
              className="grid gap-3 rounded-xl border border-filet bg-surface p-4 min-[820px]:p-5"
            >
              {bloc ? (
                <p className="rounded-lg bg-[#F6F2E8] px-3 py-2 text-[14.5px] text-texte-secondaire italic">« {extrait(texteBrut(bloc.html))} »</p>
              ) : ancien ? (
                <p className="rounded-lg bg-[#F6F2E8] px-3 py-2 text-[14.5px] text-texte-secondaire italic">
                  « {extrait(texteBrut(ancien))} »
                  <span className="block text-[12.5px] not-italic">Paragraphe d&apos;une version précédente, modifié ou retiré depuis.</span>
                </p>
              ) : (
                <div>
                  <Chip variante="neutre">Commentaire général</Chip>
                </div>
              )}
              <ul className="grid gap-3">
                {g.commentaires.map((c) => (
                  <li key={c.id} className="grid gap-2.5 border-t border-filet pt-3 first:border-t-0 first:pt-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13.5px]">
                      <span>
                        <strong className="font-semibold">
                          {c.ceo.prenom} {c.ceo.nom}
                        </strong>
                        <span className="text-texte-secondaire">, {c.ceo.entreprise}</span>
                      </span>
                      <span className="text-texte-secondaire">
                        {formaterDateHeure(c.creeLe)}, version {c.version}
                      </span>
                    </div>
                    <p className="text-[15.5px] whitespace-pre-line [overflow-wrap:anywhere]">{c.texte}</p>
                    <div role="group" aria-label="Traitement" className="flex flex-wrap gap-1.5">
                      {STATUTS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={c.statut === s}
                          disabled={enCours}
                          onClick={() => changerStatut(c, s)}
                          className={
                            "min-h-10 rounded-[10px] border px-3 text-[13.5px] font-medium " +
                            (c.statut === s ? "border-eau bg-eau text-white" : "border-filet-fort bg-surface text-texte-secondaire hover:text-encre")
                          }
                        >
                          {LIBELLES_STATUTS_COMMENTAIRE[s]}
                        </button>
                      ))}
                    </div>
                    <div className="grid gap-1.5">
                      <label htmlFor={`note-${c.id}`} className="text-[13px] font-medium text-texte-secondaire">
                        Note interne (jamais visible par le CEO)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <input
                          id={`note-${c.id}`}
                          value={note(c)}
                          maxLength={1000}
                          onChange={(e) => setNotes((n) => ({ ...n, [c.id]: e.target.value }))}
                          placeholder="Ce que l'équipe en fait"
                          className="min-h-11 min-w-0 flex-1 basis-60 rounded-[10px] border border-filet-fort bg-surface px-3 text-[15px] outline-none focus:border-eau focus:shadow-[0_0_0_3px_var(--color-eau-doux)]"
                        />
                        <Button
                          disabled={enCours || note(c).trim() === c.note.trim()}
                          onClick={() => enregistrer(c, c.statut, note(c), "Note interne enregistrée")}
                        >
                          <Save aria-hidden="true" strokeWidth={1.75} />
                          Enregistrer la note
                        </Button>
                      </div>
                    </div>
                    {c.traitePar && c.traiteLe ? (
                      <p className="text-[12.5px] text-texte-secondaire">
                        Traité par {c.traitePar}, le {formaterDateHeure(c.traiteLe)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      <Modal
        ouvert={integration !== null}
        titre="Intégrer au texte signé ?"
        onFermer={() => setIntegration(null)}
        pied={
          integration ? (
            <>
              <Button
                variante="discret"
                disabled={enCours}
                onClick={() => enregistrer(integration, "retenu", note(integration), "Commentaire : Retenu pour la suite")}
              >
                Retenu pour la suite
              </Button>
              <Button
                variante="principal"
                disabled={enCours}
                onClick={() => enregistrer(integration, "integre", note(integration), "Commentaire : Intégré")}
              >
                Intégrer quand même
              </Button>
            </>
          ) : null
        }
      >
        <p className="flex items-start gap-2.5 rounded-[10px] bg-sureleve px-4 py-3 text-[14px] text-encre [&_svg]:mt-0.5 [&_svg]:size-[18px] [&_svg]:shrink-0">
          <AlertTriangle aria-hidden="true" strokeWidth={1.75} />
          <span>
            Le texte est gelé : seules des corrections mineures restent possibles. Intégrer un changement de fond demanderait de
            revenir en rédaction, ce qui n&apos;est plus possible après l&apos;envoi des liens.
          </span>
        </p>
        <p>Recommandation : « Retenu pour la suite ». « Intégré » seulement pour une correction de forme.</p>
        {integration ? <p className="rounded-lg bg-[#F6F2E8] px-3 py-2 text-[14.5px] italic">{integration.texte}</p> : null}
      </Modal>
      <Toast message={message} />
    </div>
  );
}
