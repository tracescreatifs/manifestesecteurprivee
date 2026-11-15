"use client";

import {
  BookOpen,
  Calendar,
  CheckCircle2,
  CircleSlash,
  Droplets,
  FileCheck,
  FileDown,
  FileText,
  MessageSquare,
  PenTool,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DocumentA4 } from "@/components/document/document-a4";
import { Button, classesBouton } from "@/components/ui/button";
import { formaterDateHeure, formaterJourLong } from "@/lib/dates";
import type { LigneAnnexeA4 } from "@/lib/signature/annexe";
import type { CommentaireCeo, EspaceCeo } from "@/lib/signature/serveur";
import { numerosDesPoints } from "@/lib/texte/comparer";
import { htmlSur, texteBrut } from "@/lib/texte/html";

import { commenter, marquerOuvert } from "./actions";
import { EXPEDITEUR, Feuille, LiensPied } from "./commun";
import { ParcoursSignature, type Signee } from "./parcours-signature";

/*
  Espace CEO (prototype 2-ceo.html) : lecture, page A4 avec l'annexe, commentaires,
  signature en trois étapes, puis carte « Votre signature » au retour sur le lien.
  Mise en page téléphone sous 760 px, ordinateur au-dessus.
*/

type Vue = "lecture" | "a4";

const extrait = (t: string, n = 110) => (t.length > n ? `${t.slice(0, n).trim()}…` : t);

export function EspaceCeoClient({ jeton, espace }: { jeton: string; espace: EspaceCeo }) {
  const router = useRouter();
  const version = espace.version;
  const [vue, setVue] = useState<Vue>("lecture");
  const [focus, setFocus] = useState<string | null>(null);
  const [feuille, setFeuille] = useState<{ blocId: string | null } | null>(null);
  const [texteCommentaire, setTexteCommentaire] = useState("");
  const [erreurCommentaire, setErreurCommentaire] = useState<string>();
  const [envoiCommentaire, setEnvoiCommentaire] = useState(false);
  const [commentaires, setCommentaires] = useState<CommentaireCeo[]>(espace.commentaires);
  const [parcours, setParcours] = useState(false);
  const [signeeLocale, setSigneeLocale] = useState<Signee | null>(null);
  const [annonce, setAnnonce] = useState<string | null>(null);

  /* « Ouvert » : noté par le navigateur après l'affichage, jamais par un aperçu de lien (D65) */
  useEffect(() => {
    marquerOuvert({ jeton }).catch(() => undefined);
  }, [jeton]);

  /* Message bref, effacé après quelques secondes */
  useEffect(() => {
    if (!annonce) return;
    const t = window.setTimeout(() => setAnnonce(null), 2600);
    return () => window.clearTimeout(t);
  }, [annonce]);

  const signature = espace.signature
    ? espace.signature
    : signeeLocale
      ? {
          reference: signeeLocale.signature.reference,
          signeLe: signeeLocale.signature.signeLe,
          validee: signeeLocale.signature.validee,
        }
      : null;

  const ouvert = espace.etat === "ouvert";
  const peutCommenter = ouvert && espace.identifie;
  const prenom = espace.signature?.prenom || signeeLocale?.signature.prenom || espace.saisieInitiale.prenom;
  const dateLimite = formaterJourLong(espace.dateLimite);
  const blocs = useMemo(() => version?.blocs ?? [], [version]);
  const numeros = useMemo(() => numerosDesPoints(blocs), [blocs]);

  /* Annexe : signatures validées, et la sienne même en attente (jamais celles des autres en attente) */
  const lignesAnnexe: LigneAnnexeA4[] = useMemo(() => {
    const lignes = espace.annexe.map((l) => ({ ...l }));
    if (signeeLocale && !espace.annexe.some((l) => l.moi)) {
      const s = signeeLocale.signature;
      lignes.push({
        cle: "moi",
        prenom: s.prenom,
        nom: s.nom,
        fonction: s.fonction,
        entreprise: s.entreprise,
        maillon: s.maillon,
        trace: signeeLocale.trace,
        signeLe: s.signeLe,
        moi: true,
      });
    }
    return lignes;
  }, [espace.annexe, signeeLocale]);
  const autresLignes = useMemo(() => espace.annexe.filter((l) => !l.moi), [espace.annexe]);

  const ouvrirCommentaire = (blocId: string | null) => {
    setTexteCommentaire("");
    setErreurCommentaire(undefined);
    setFeuille({ blocId });
  };

  const envoyerCommentaire = async () => {
    if (!feuille || envoiCommentaire) return;
    const texte = texteCommentaire.trim();
    if (texte.length < 2) return setErreurCommentaire("Écrivez au moins deux caractères.");
    setEnvoiCommentaire(true);
    try {
      const r = await commenter({ jeton, texte, blocId: feuille.blocId });
      if (!r.ok) return setErreurCommentaire(r.erreur);
      setCommentaires((c) => [...c, r.commentaire]);
      setFeuille(null);
      setFocus(null);
      setAnnonce("Commentaire transmis à l'équipe de rédaction");
    } catch {
      setErreurCommentaire("La connexion a échoué. Vérifiez votre connexion Internet, puis réessayez.");
    } finally {
      setEnvoiCommentaire(false);
    }
  };

  const blocCommente = feuille?.blocId ? blocs.find((b) => b.id === feuille.blocId) : null;

  /* ----- Morceaux de l'écran ----- */

  const bascule = (
    <div role="group" aria-label="Affichage" className="inline-grid w-fit grid-cols-2 overflow-hidden rounded-[10px] border border-filet-fort bg-surface">
      {(
        [
          ["lecture", "Lecture", BookOpen],
          ["a4", "Page A4", FileText],
        ] as const
      ).map(([cle, libelle, Icone]) => (
        <button
          key={cle}
          type="button"
          aria-pressed={vue === cle}
          onClick={() => setVue(cle)}
          className={
            "inline-flex min-h-11 items-center justify-center gap-1.5 px-3 text-[14px] font-medium [&_svg]:size-[18px] " +
            (vue === cle ? "bg-eau text-white" : "text-texte-secondaire hover:text-encre")
          }
        >
          <Icone aria-hidden="true" strokeWidth={1.75} />
          {libelle}
        </button>
      ))}
    </div>
  );

  const lecture = version ? (
    <div className="lecture">
      <h2 className="l-titre">
        {version.titre.split("\n").map((ligne, i) => (
          <span key={i}>
            {i > 0 ? <br /> : null}
            {ligne}
          </span>
        ))}
      </h2>
      <div className="l-sous">{version.sousTitre}</div>
      <div className="l-filet" />
      {blocs.map((b, i) => {
        const choisi = focus === b.id;
        const contenu = (
          <>
            {b.type === "li" ? <span className="num">{numeros[i]}.</span> : null}
            <span dangerouslySetInnerHTML={{ __html: htmlSur(b.html) }} />
          </>
        );
        return (
          <div key={b.id} className={`rb ${b.type} ${choisi ? "sel" : ""}`} data-commentable={peutCommenter ? "" : undefined}>
            {peutCommenter ? (
              <div
                role="button"
                tabIndex={0}
                aria-expanded={choisi}
                aria-label={`${texteBrut(b.html).slice(0, 80)} : choisir ce passage pour le commenter`}
                className="rb-texte"
                onClick={() => setFocus(choisi ? null : b.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setFocus(choisi ? null : b.id);
                  }
                }}
              >
                {contenu}
              </div>
            ) : (
              <div className="rb-texte">{contenu}</div>
            )}
            {choisi && peutCommenter ? (
              <div className="rb-action">
                <button
                  type="button"
                  onClick={() => ouvrirCommentaire(b.id)}
                  className="inline-flex min-h-11 items-center gap-1.5 font-interface text-[14px] font-medium text-eau [&_svg]:size-[18px]"
                >
                  <MessageSquare aria-hidden="true" strokeWidth={1.75} />
                  Commenter ce passage
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  ) : (
    <p className="text-texte-secondaire">Le texte n&apos;est pas disponible pour l&apos;instant.</p>
  );

  const pageA4 = version ? (
    <DocumentA4
      titre={version.titre}
      sousTitre={version.sousTitre}
      blocs={blocs}
      brouillon={false}
      libelle={`Version ${version.numero}`}
      annexe={{ lignes: lignesAnnexe }}
    />
  ) : null;

  const carteSignature = signature ? (
    <div className="grid gap-3 rounded-2xl border border-filet bg-surface p-5">
      <h2 className="flex items-center gap-2 font-titre text-[19px] font-normal [&_svg]:size-[18px] [&_svg]:text-texte-secondaire">
        <PenTool aria-hidden="true" strokeWidth={1.75} />
        Votre signature
      </h2>
      <p className="text-[14.5px]">
        Signée le {formaterDateHeure(signature.signeLe)}.
        <br />
        Référence <span className="tabular-nums">{signature.reference}</span>.
      </p>
      <Link className={classesBouton("secondaire")} href={`/s/${jeton}/accuse`}>
        <FileDown aria-hidden="true" strokeWidth={1.75} />
        Télécharger mon accusé
      </Link>
    </div>
  ) : null;

  const listeCommentaires = commentaires.length ? (
    <div className="grid gap-3 rounded-2xl border border-filet bg-surface p-5">
      <h2 className="flex items-center gap-2 font-titre text-[19px] font-normal [&_svg]:size-[18px] [&_svg]:text-texte-secondaire">
        <MessageSquare aria-hidden="true" strokeWidth={1.75} />
        Vos commentaires
      </h2>
      <ul className="grid gap-3">
        {commentaires.map((c) => {
          const bloc = c.blocId ? blocs.find((b) => b.id === c.blocId) : null;
          return (
            <li key={c.id} className="grid gap-1 border-t border-filet pt-3 first:border-t-0 first:pt-0">
              <span className="text-[12.5px] text-texte-secondaire">
                {bloc ? `« ${extrait(texteBrut(bloc.html), 70)} »` : "Sur l'ensemble du texte"}, le {formaterDateHeure(c.creeLe)}
              </span>
              <p className="text-[14.5px] whitespace-pre-line [overflow-wrap:anywhere]">{c.texte}</p>
            </li>
          );
        })}
      </ul>
      <p className="text-[12.5px] text-texte-secondaire">Lus uniquement par l&apos;équipe de rédaction.</p>
    </div>
  ) : null;

  /* ----- En-tête fixe (ordinateur) ----- */
  const entete = (
    <header className="barre-fixe fixed inset-x-0 top-0 z-20 hidden h-16 items-center gap-3 border-b border-filet px-10 min-[760px]:flex">
      <span className="grid size-8 place-items-center rounded-lg bg-eau text-white [&_svg]:size-[18px]">
        <Droplets aria-hidden="true" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1 font-titre text-[16px] leading-tight">
        Manifeste du secteur privé sénégalais de l&apos;eau et de l&apos;assainissement
        {version?.sousTitre ? <span className="block font-interface text-[12.5px] text-texte-secondaire">{version.sousTitre}</span> : null}
      </div>
      {ouvert && !signature ? (
        <span className="inline-flex items-center gap-1.5 text-[13px] text-texte-secondaire [&_svg]:size-4">
          <Calendar aria-hidden="true" strokeWidth={1.75} />
          Signature avant le {dateLimite}
        </span>
      ) : null}
    </header>
  );

  /* ----- Écran principal ----- */
  let colonne;
  if (espace.etat === "ouvert") {
    colonne = (
      <>
        {signature ? (
          <div className="flex items-start gap-2.5 rounded-[10px] bg-succes-doux px-4 py-3 text-[14px] text-[#214d39] [&_svg]:mt-0.5 [&_svg]:size-[18px] [&_svg]:shrink-0">
            <CheckCircle2 aria-hidden="true" strokeWidth={1.75} />
            <div>
              Vous avez signé le {formaterDateHeure(signature.signeLe)}.
              {signature.validee ? "" : " Votre signature sera ajoutée à l'annexe après vérification."}
            </div>
          </div>
        ) : null}
        {prenom ? (
          <>
            <h1 className="font-titre text-[28px] leading-[1.15] font-normal min-[760px]:text-[32px]">Bonjour {prenom},</h1>
            <p className="text-[16px] leading-[1.55] text-texte-secondaire">
              {signature
                ? "Merci pour votre signature. Vous pouvez relire le texte et retrouver votre accusé."
                : "Voici le Manifeste qui sera présenté à Abu Dhabi. Lisez-le, puis signez-le. Vous pouvez aussi laisser un commentaire à l'équipe de rédaction."}
            </p>
          </>
        ) : (
          <>
            <h1 className="font-titre text-[28px] leading-[1.15] font-normal">
              Le Manifeste du secteur privé sénégalais de l&apos;eau et de l&apos;assainissement
            </h1>
            <p className="text-[16px] leading-[1.55] text-texte-secondaire">
              Vous dirigez une entreprise sénégalaise de l&apos;eau ou de l&apos;assainissement ? Lisez ce Manifeste, présenté à
              Abu Dhabi, et signez-le au nom de votre entreprise.
            </p>
          </>
        )}
        <p className="flex items-center gap-2 text-[13px] text-texte-secondaire [&_svg]:size-4 [&_svg]:shrink-0">
          <Send aria-hidden="true" strokeWidth={1.75} />
          <span>Envoyé par {EXPEDITEUR}</span>
        </p>
        <div className="flex flex-wrap gap-4 text-[13px] text-texte-secondaire [&_svg]:size-4">
          {version ? (
            <span className="inline-flex items-center gap-1.5">
              <FileCheck aria-hidden="true" strokeWidth={1.75} />
              Version {version.numero}
            </span>
          ) : null}
          {!signature ? (
            <span className="inline-flex items-center gap-1.5 min-[760px]:hidden">
              <Calendar aria-hidden="true" strokeWidth={1.75} />
              Signature avant le {dateLimite}
            </span>
          ) : null}
        </div>
        {!signature ? (
          <div className="hidden gap-2 min-[760px]:grid">
            <Button variante="principal" className="min-h-[52px] text-[16px]" onClick={() => setParcours(true)}>
              <PenTool aria-hidden="true" strokeWidth={1.75} />
              Signer le Manifeste
            </Button>
            <p className="text-[13px] text-texte-secondaire">
              Trois étapes : vos informations, votre signature, la vérification. Environ deux minutes.
            </p>
          </div>
        ) : null}
        {carteSignature}
        {peutCommenter ? (
          <div className="hidden min-[760px]:grid">
            <Button onClick={() => ouvrirCommentaire(null)}>
              <MessageSquare aria-hidden="true" strokeWidth={1.75} />
              Laisser un commentaire
            </Button>
          </div>
        ) : null}
        {listeCommentaires}
      </>
    );
  } else {
    /* Signatures closes (date limite passée ou clôture) et document publié : lecture seule */
    colonne = (
      <>
        {espace.etat === "clos" ? (
          <div className="grid justify-items-center gap-3 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-argile-doux text-argile [&_svg]:size-[30px]">
              <CircleSlash aria-hidden="true" strokeWidth={1.75} />
            </span>
            <h1 className="font-titre text-[22px] font-normal">Les signatures sont closes</h1>
            <p className="text-texte-secondaire">La période de signature est terminée. Vous pouvez encore lire le texte.</p>
          </div>
        ) : (
          <>
            <h1 className="font-titre text-[28px] leading-[1.15] font-normal">{prenom ? `Bonjour ${prenom},` : "Bonjour,"}</h1>
            <p className="text-[16px] leading-[1.55] text-texte-secondaire">Le Manifeste a été présenté à Abu Dhabi. Vous pouvez relire le texte.</p>
          </>
        )}
        {carteSignature}
        {listeCommentaires}
      </>
    );
  }

  return (
    <div data-ambiance="ceo" className="min-h-dvh bg-papier text-encre">
      {entete}
      <main className="mx-auto grid w-full max-w-[1160px] content-start gap-4 px-5 pt-6 pb-[104px] min-[760px]:grid-cols-[minmax(0,1fr)_340px] min-[760px]:items-start min-[760px]:gap-12 min-[760px]:px-10 min-[760px]:pt-24 min-[760px]:pb-16">
        <aside className="grid min-w-0 content-start gap-4 min-[760px]:sticky min-[760px]:top-24 min-[760px]:order-2">
          <p className="text-[13px] text-texte-secondaire min-[760px]:hidden">Manifeste</p>
          {colonne}
        </aside>
        <div className="grid min-w-0 content-start gap-4 min-[760px]:order-1">
          {bascule}
          {vue === "lecture" ? lecture : pageA4}
          {vue === "lecture" && version ? (
            peutCommenter ? (
              <p className="text-[13px] text-texte-secondaire">
                <span className="min-[760px]:hidden">Touchez un paragraphe pour le commenter.</span>
                <span className="hidden min-[760px]:inline">Cliquez sur un paragraphe pour le commenter.</span>
              </p>
            ) : ouvert && !espace.identifie ? (
              <p className="text-[13px] text-texte-secondaire">
                Vous pourrez commenter le texte dès que vous aurez indiqué votre nom, à la première étape de la signature.
              </p>
            ) : null
          ) : null}
          <LiensPied whatsapp={espace.whatsappTaskForce} />
        </div>
      </main>

      {/* Barre fixe du bas (téléphone) */}
      {ouvert ? (
        <div
          className={
            "barre-fixe fixed inset-x-0 bottom-0 z-20 grid gap-2.5 border-t border-filet px-4 py-3 min-[760px]:hidden " +
            (signature || !peutCommenter ? "grid-cols-1" : "grid-cols-[auto_1fr]")
          }
        >
          {signature ? (
            peutCommenter ? (
              <Button onClick={() => ouvrirCommentaire(null)}>
                <MessageSquare aria-hidden="true" strokeWidth={1.75} />
                Laisser un commentaire
              </Button>
            ) : null
          ) : (
            <>
              {peutCommenter ? (
                <Button onClick={() => ouvrirCommentaire(null)} aria-label="Laisser un commentaire">
                  <MessageSquare aria-hidden="true" strokeWidth={1.75} />
                </Button>
              ) : null}
              <Button variante="principal" onClick={() => setParcours(true)}>
                <PenTool aria-hidden="true" strokeWidth={1.75} />
                Signer le Manifeste
              </Button>
            </>
          )}
        </div>
      ) : null}

      <Feuille ouverte={feuille !== null} titre="Votre commentaire" onFermer={() => setFeuille(null)}>
        <h3 className="font-titre text-xl font-normal">Votre commentaire</h3>
        {blocCommente ? (
          <p className="rounded-lg bg-[#F6F2E8] px-3 py-2 text-[14px] text-texte-secondaire italic">
            « {extrait(texteBrut(blocCommente.html))} »
          </p>
        ) : (
          <p className="text-[13px] text-texte-secondaire">Commentaire général sur le texte.</p>
        )}
        <label htmlFor="commentaire" className="sr-only">
          Votre remarque
        </label>
        <textarea
          id="commentaire"
          autoFocus
          maxLength={1000}
          value={texteCommentaire}
          onChange={(e) => {
            setTexteCommentaire(e.target.value);
            setErreurCommentaire(undefined);
          }}
          placeholder="Écrivez votre remarque"
          aria-invalid={Boolean(erreurCommentaire)}
          aria-describedby="commentaire-aide"
          className="min-h-[100px] w-full resize-y rounded-[10px] border border-filet-fort bg-surface p-3 text-[16px] outline-none focus:border-eau focus:shadow-[0_0_0_3px_var(--color-eau-doux)]"
        />
        <div id="commentaire-aide" className="flex justify-between gap-3 text-[13px] text-texte-secondaire">
          <span>Lu uniquement par l&apos;équipe de rédaction, pas par les autres signataires.</span>
          <span className="shrink-0 tabular-nums">{texteCommentaire.length} / 1000</span>
        </div>
        {erreurCommentaire ? (
          <p role="alert" className="text-[13.5px] text-erreur">
            {erreurCommentaire}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setFeuille(null)}>Annuler</Button>
          <Button variante="principal" onClick={envoyerCommentaire} disabled={envoiCommentaire}>
            <Send aria-hidden="true" strokeWidth={1.75} />
            Envoyer
          </Button>
        </div>
      </Feuille>

      {ouvert && version && (!espace.signature || signeeLocale) ? (
        <ParcoursSignature
          ouvert={parcours}
          onFermer={() => setParcours(false)}
          jeton={jeton}
          saisieInitiale={espace.saisieInitiale}
          saisieListe={espace.origine === "liste" ? espace.saisieListe : null}
          maillons={espace.maillons}
          version={version.numero}
          texteConsentement={espace.texteConsentement}
          annexe={autresLignes}
          onSignee={(s) => {
            setSigneeLocale(s);
            router.refresh();
          }}
          onRefus={() => router.refresh()}
        />
      ) : null}

      <div
        role="status"
        aria-live="polite"
        className={
          "pointer-events-none fixed inset-x-3.5 bottom-[84px] z-30 mx-auto w-auto max-w-[460px] min-[760px]:top-[84px] min-[760px]:bottom-auto " +
          (annonce ? "" : "sr-only")
        }
      >
        {annonce ? (
          <div className="flex items-center gap-2 rounded-xl bg-encre px-3.5 py-3 text-[14px] text-white">{annonce}</div>
        ) : null}
      </div>
    </div>
  );
}
