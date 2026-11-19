import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { joursRestants, pourcentage, quandRelatif, signaturesCloses } from "@/lib/admin/calculs";
import type { TableauDeBord } from "@/lib/admin/tableau-de-bord";
import { formaterDateLimiteComplete } from "@/lib/ceo/message";

/*
  Cartes du tableau de bord (R1). Valeurs réelles seulement ; calculs définis dans decisions.md (D120).
  L'eau (#1D4E5C et #6E9AA6) ne signifie que la progression des signatures : réservoir, parcours des liens, taux.
*/

const EAU_CLAIRE = "#6E9AA6";
const NEUTRE = "#B9BFC3";
const PISTE = "#EEEEEC";

const pluriel = (n: number, mot: string) => `${mot}${n > 1 ? "s" : ""}`;
const pourCent = (n: number) => `${n} %`;

export function Carte({
  titre,
  id,
  className = "",
  entete,
  pied,
  children,
}: {
  titre: string;
  id: string;
  className?: string;
  entete?: ReactNode;
  pied?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article aria-labelledby={id} className={`grid content-start gap-4 rounded-carte bg-surface p-5 shadow-douce min-[820px]:p-6 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <h2 id={id} className="text-[14.5px] font-medium text-texte-secondaire">
          {titre}
        </h2>
        {entete}
      </div>
      {children}
      {pied ? <div className="mt-auto">{pied}</div> : null}
    </article>
  );
}

/* Lien discret en pied de carte, vers la rubrique où agir */
export function LienCarte({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-controle text-[14px] font-medium text-eau underline-offset-4 hover:underline"
    >
      {children}
      <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.75} />
    </Link>
  );
}

/*
  Réservoir : l'eau monte au taux de signature (signatures de l'annexe sur les invités), avec la courbe de la charte
  quand le niveau change ; deux vagues lentes en sens opposés (10 s et 16 s, boucle linéaire), immobiles
  si l'utilisateur a demandé des animations réduites.
*/
function Reservoir({ taux }: { taux: number }) {
  const vague = "M0 5 Q 24 0 48 5 T 96 5 T 144 5 T 192 5 V 10 H 0 Z";
  return (
    <div
      role="img"
      aria-label={`Niveau d'eau : ${taux} pour cent des invités ont signé`}
      className="relative h-36 w-24 shrink-0 overflow-hidden rounded-rangee bg-[#F1F5F6]"
    >
      <div className="niveau-eau absolute inset-x-0 bottom-0 bg-eau" style={{ height: `${taux}%` }}>
        {taux > 0 && taux < 100 ? (
          <>
            <svg aria-hidden="true" viewBox="0 0 192 10" preserveAspectRatio="none" className="vague-arriere absolute bottom-[calc(100%+2px)] left-0 h-2.5 w-[200%]">
              <path d={vague} fill={EAU_CLAIRE} fillOpacity={0.45} />
            </svg>
            <svg aria-hidden="true" viewBox="0 0 192 10" preserveAspectRatio="none" className="vague-avant absolute bottom-[calc(100%-1px)] left-0 h-2.5 w-[200%]">
              <path d={vague} fill="#1D4E5C" />
            </svg>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function CarteSignatures({ d }: { d: TableauDeBord }) {
  const invites = d.parcours.total;
  const taux = pourcentage(d.annexe, invites);
  return (
    <Carte
      titre="Signatures"
      id="carte-signatures"
      className="@[560px]:col-span-2"
      entete={
        <div className="grid justify-items-end gap-0.5 text-right">
          <p className="font-titre text-[28px] leading-none font-light text-eau tabular-nums">{pourCent(taux)}</p>
          <p className="text-[13px] text-texte-secondaire tabular-nums">+{d.aujourdhui} aujourd&apos;hui</p>
        </div>
      }
      pied={<LienCarte href="/admin/document">Voir l&apos;annexe</LienCarte>}
    >
      <div className="flex items-end gap-5">
        <Reservoir taux={taux} />
        <div className="grid min-w-0 gap-1.5">
          <p className="chiffre-cle">{d.annexe}</p>
          <p className="text-[14.5px] text-texte-secondaire">
            {pluriel(d.annexe, "signature")} dans l&apos;annexe, sur {invites} {pluriel(invites, "invité")}
          </p>
          {d.surPlace ? (
            <p className="text-[13px] text-texte-secondaire">
              dont {d.surPlace} sur place
            </p>
          ) : null}
        </div>
      </div>
    </Carte>
  );
}

/* Avant le gel : un état propre, sans chiffre de signature */
export function CarteAvantGel({ invites }: { invites: number }) {
  return (
    <Carte titre="Signatures" id="carte-signatures" className="@[560px]:col-span-2" pied={<LienCarte href="/admin/ceo">Préparer la liste des CEO</LienCarte>}>
      <div className="grid gap-2">
        <p className="font-titre text-[26px] leading-tight font-light">Les signatures commencent après le gel du texte</p>
        <p className="text-[14.5px] text-texte-secondaire">
          {invites ? `${invites} CEO dans la liste. Les liens personnels s'ouvrent au gel.` : "Aucun CEO dans la liste pour l'instant."}
        </p>
      </div>
    </Carte>
  );
}

export function CarteParcours({ d }: { d: TableauDeBord }) {
  const p = d.parcours;
  const segments = [
    { cle: "signe", libelle: pluriel(p.signe, "Signé"), nombre: p.signe, couleur: "#1D4E5C" },
    { cle: "ouvert", libelle: `${pluriel(p.ouvert, "Ouvert")}, non ${pluriel(p.ouvert, "signé")}`, nombre: p.ouvert, couleur: EAU_CLAIRE },
    { cle: "envoye", libelle: pluriel(p.envoye, "Envoyé"), nombre: p.envoye, couleur: NEUTRE },
  ];
  const total = Math.max(1, p.total);
  return (
    <Carte titre="Parcours des liens" id="carte-parcours" pied={<LienCarte href="/admin/ceo">Ouvrir la liste</LienCarte>}>
      <div
        role="img"
        aria-label={`Sur ${p.total} ${pluriel(p.total, "invité")} : ${p.signe} ${pluriel(p.signe, "signé")}, ${p.ouvert} ${pluriel(p.ouvert, "ouvert")} non ${pluriel(p.ouvert, "signé")}, ${p.envoye} ${pluriel(p.envoye, "envoyé")}, ${p.a_envoyer} sans lien envoyé`}
        className="flex h-1.5 overflow-hidden rounded-full"
        style={{ background: PISTE }}
      >
        {segments.map((s) =>
          s.nombre ? <span key={s.cle} style={{ width: `${(s.nombre / total) * 100}%`, background: s.couleur }} /> : null,
        )}
      </div>
      <ul className="grid gap-1.5">
        {segments.map((s) => (
          <li key={s.cle} className="flex items-center gap-2.5 text-[14.5px]">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: s.couleur }} />
            <span className="min-w-0 flex-1">{s.libelle}</span>
            <span className="font-medium tabular-nums">{s.nombre}</span>
          </li>
        ))}
      </ul>
      <p className="text-[13.5px] text-texte-secondaire">
        {p.a_envoyer ? `${p.a_envoyer} ${pluriel(p.a_envoyer, "invité")} sans lien envoyé` : "Tous les invités ont reçu leur lien"}
      </p>
    </Carte>
  );
}

export function CarteCloture({ d, maintenant }: { d: TableauDeBord; maintenant: Date }) {
  const closes = signaturesCloses(d.statut, d.dateLimite, maintenant);
  const date = formaterDateLimiteComplete(closes && d.statut !== "gele" ? (d.closLe ?? d.dateLimite) : d.dateLimite);
  const jours = joursRestants(d.dateLimite, maintenant);
  return (
    <Carte titre="Clôture des signatures" id="carte-cloture">
      {closes ? (
        <div className="grid gap-1">
          <p className="font-titre text-[26px] leading-tight font-light">Signatures closes</p>
          <p className="text-[14.5px] text-texte-secondaire">
            Depuis le {date.dakar}
            <br />
            <span className="text-[13.5px]">{date.abuDhabi}</span>
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {jours === 0 ? (
            <p className="font-titre text-[40px] leading-none font-light">Dernier jour</p>
          ) : (
            <p className="flex items-baseline gap-2.5">
              <span className="chiffre-cle">{jours}</span>
              <span className="text-[14.5px] text-texte-secondaire">{jours === 1 ? "jour restant" : "jours restants"}</span>
            </p>
          )}
          <p className="text-[14.5px]">
            {d.statut === "redaction" ? "Date limite prévue : " : "Jusqu'au "}
            {date.dakar}
            <br />
            <span className="text-[13.5px] text-texte-secondaire">{date.abuDhabi}</span>
          </p>
        </div>
      )}
    </Carte>
  );
}

/* Taux de signature des liens envoyés : demi-cercle fin, la part signée en eau profonde */
export function CarteTaux({ d }: { d: TableauDeBord }) {
  const p = d.parcours;
  const atteints = p.total - p.a_envoyer;
  const taux = pourcentage(p.signe, atteints);
  const arc = "M10 60 A50 50 0 0 1 110 60";
  return (
    <Carte titre="Taux de signature" id="carte-taux">
      <div role="img" aria-label={`Taux de signature : ${taux} pour cent des liens envoyés`} className="relative mx-auto w-full max-w-[220px]">
        <svg aria-hidden="true" viewBox="0 0 120 66" className="block w-full">
          <path d={arc} fill="none" stroke={PISTE} strokeWidth={6} strokeLinecap="round" />
          {taux > 0 ? (
            <path d={arc} fill="none" stroke="#1D4E5C" strokeWidth={6} strokeLinecap="round" pathLength={100} strokeDasharray={`${taux} 100`} />
          ) : null}
        </svg>
        <p className="absolute inset-x-0 bottom-0 text-center font-titre text-[34px] leading-none font-light tabular-nums">{pourCent(taux)}</p>
      </div>
      {/* Libellé explicite (R2) : le taux porte sur les liens envoyés ; le réservoir garde « sur N invités » */}
      <div className="grid justify-items-center gap-0.5 text-center">
        <p className="text-[14.5px] font-medium">des liens envoyés</p>
        <p className="text-[13.5px] text-texte-secondaire">
          {p.signe} {pluriel(p.signe, "signé")} sur {atteints} {pluriel(atteints, "lien")} {pluriel(atteints, "envoyé")}
        </p>
      </div>
    </Carte>
  );
}

export function CarteDoleances({ d }: { d: TableauDeBord }) {
  const { disponible, total, themes } = d.doleances;
  const max = Math.max(1, ...themes.map((t) => t.nombre));
  const visibles = themes.slice(0, 6);
  const reste = themes.slice(6).reduce((n, t) => n + t.nombre, 0);
  return (
    <Carte
      titre="Doléances par thème"
      id="carte-doleances"
      entete={total ? <p className="text-[13px] text-texte-secondaire tabular-nums">{total} au total</p> : null}
      pied={<LienCarte href="/admin/doleances">Ouvrir les doléances</LienCarte>}
    >
      {!disponible ? (
        <p className="text-[14.5px] text-texte-secondaire">Exécutez la migration 0009 pour recevoir les doléances.</p>
      ) : !total ? (
        <p className="text-[14.5px] text-texte-secondaire">
          {d.statut === "redaction" ? "Le dépôt des doléances s'ouvre au gel du texte." : "Aucune doléance pour l'instant."}
        </p>
      ) : (
        <ol className="grid gap-2.5">
          {visibles.map((t) => (
            <li key={t.libelle} className="grid gap-1">
              <span className="flex items-baseline justify-between gap-3 text-[14px]">
                <span className="min-w-0">{t.libelle}</span>
                <span className="font-medium tabular-nums">{t.nombre}</span>
              </span>
              <span aria-hidden="true" className="h-1 overflow-hidden rounded-full" style={{ background: PISTE }}>
                <span className="block h-full rounded-full bg-texte-secondaire" style={{ width: `${(t.nombre / max) * 100}%` }} />
              </span>
            </li>
          ))}
          {reste ? <li className="text-[13px] text-texte-secondaire">Autres thèmes : {reste}</li> : null}
        </ol>
      )}
    </Carte>
  );
}

export function CarteActions({ d, maintenant }: { d: TableauDeBord; maintenant: Date }) {
  return (
    <Carte
      titre="Dernières actions"
      id="carte-actions"
      className="@[560px]:col-span-2 @[860px]:col-span-3"
      pied={<LienCarte href="/admin/reglages?onglet=journal">Voir le journal</LienCarte>}
    >
      {d.actions.length ? (
        <ol className="grid">
          {d.actions.map((a) => (
            <li
              key={a.id}
              className="grid gap-0.5 border-t border-filet py-2.5 text-[14px] first:border-t-0 first:pt-0 @[700px]:grid-cols-[190px_minmax(0,1fr)] @[700px]:gap-4"
            >
              <time dateTime={a.quand} className="text-texte-secondaire tabular-nums">
                {quandRelatif(a.quand, maintenant)}
              </time>
              <span className="min-w-0 break-words">
                <strong className="font-semibold">{a.acteur}</strong> : {a.libelle}
                {a.cible ? <span className="text-texte-secondaire">, {a.cible}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[14.5px] text-texte-secondaire">Aucune action pour l&apos;instant.</p>
      )}
    </Carte>
  );
}
