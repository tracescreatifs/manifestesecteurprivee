"use client";

import { FileSpreadsheet, ScanLine, Upload } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Modal } from "@/components/ui/modal";
import {
  LIBELLES_SIGNALEMENTS,
  analyserGrille,
  lireTexteDelimite,
  marquerDoublons,
  type ColonnesReconnues,
  type LigneListe,
} from "@/lib/ceo/lire-liste";
import { formaterTelephone } from "@/lib/ceo/normaliser";

import { importerListe } from "./actions";

type Props = {
  ouvert: boolean;
  onFermer: () => void;
  maillons: string[];
  existants: { entreprises: string[]; telephones: string[] };
  onImporte: (nombre: number) => void;
};

const NOMS_COLONNES: Record<keyof ColonnesReconnues, string> = {
  entreprise: "Entreprise",
  prenom: "Prénom",
  nom: "Nom",
  fonction: "Fonction",
  maillon: "Maillon",
  telephone: "Téléphone",
  email: "Email",
};

/*
  Import de la liste des CEO : fichier Excel (.xlsx), CSV, ou tableau collé.
  L'aperçu est calculé ici ; le serveur revalide chaque ligne au moment de l'import.
*/
export function ImportListe({ ouvert, onFermer, maillons, existants, onImporte }: Props) {
  const [fichier, setFichier] = useState("");
  const [colle, setColle] = useState("");
  const [lignes, setLignes] = useState<LigneListe[]>([]);
  const [colonnes, setColonnes] = useState<ColonnesReconnues | null>(null);
  const [cochees, setCochees] = useState<Set<number>>(new Set());
  const [erreur, setErreur] = useState<string>();
  const [lecture, setLecture] = useState(false);
  const [enCours, demarrer] = useTransition();

  const reinitialiser = () => {
    setFichier("");
    setColle("");
    setLignes([]);
    setColonnes(null);
    setCochees(new Set());
    setErreur(undefined);
  };

  const fermer = () => {
    reinitialiser();
    onFermer();
  };

  const appliquer = (grille: unknown[][], nom: string) => {
    const r = analyserGrille(grille, maillons);
    if (!r.ok) {
      setErreur(r.erreur);
      setLignes([]);
      setColonnes(null);
      return;
    }
    const marquees = marquerDoublons(r.lignes, existants);
    setErreur(marquees.length ? undefined : "Aucune ligne avec un nom d'entreprise sous l'en-tête.");
    setFichier(nom);
    setLignes(marquees);
    setColonnes(r.colonnes);
    /* Les doublons sont décochés par défaut (D21) */
    setCochees(new Set(marquees.filter((l) => !l.signalements.includes("deja_dans_la_liste")).map((l) => l.numero)));
  };

  const lireFichier = async (f: File | undefined) => {
    if (!f) return;
    setErreur(undefined);
    if (/\.xls$/i.test(f.name)) {
      setErreur("Ce fichier est au format .xls (ancien Excel) : enregistrez-le au format .xlsx, puis réessayez.");
      return;
    }
    setLecture(true);
    try {
      if (/\.csv$/i.test(f.name)) {
        appliquer(lireTexteDelimite(await f.text()), f.name);
      } else if (/\.xlsx$/i.test(f.name)) {
        const { readSheet } = await import("read-excel-file/browser");
        appliquer((await readSheet(f)) as unknown[][], f.name);
      } else {
        setErreur("Choisissez un fichier Excel (.xlsx) ou CSV.");
      }
    } catch {
      setErreur("Ce fichier n'a pas pu être lu. Enregistrez-le au format .xlsx ou .csv, puis réessayez.");
    } finally {
      setLecture(false);
    }
  };

  const nombre = cochees.size;
  const resume = useMemo(() => {
    const compte = (s: LigneListe["signalements"][number]) => lignes.filter((l) => l.signalements.includes(s)).length;
    return {
      doublons: compte("deja_dans_la_liste"),
      sansTel: compte("sans_telephone"),
    };
  }, [lignes]);

  const importer = () =>
    demarrer(async () => {
      const choisies = lignes.filter((l) => cochees.has(l.numero));
      const r = await importerListe({
        fichier,
        lignes: choisies.map((l) => ({
          prenom: l.prenom,
          nom: l.nom,
          fonction: l.fonction,
          entreprise: l.entreprise,
          maillon: l.maillon,
          telephone: l.telephone,
          email: l.email,
        })),
      });
      if (!r.ok) return setErreur(r.erreur);
      reinitialiser();
      onImporte(r.nombre);
    });

  const basculer = (numero: number) =>
    setCochees((avant) => {
      const apres = new Set(avant);
      if (apres.has(numero)) apres.delete(numero);
      else apres.add(numero);
      return apres;
    });

  return (
    <Modal
      ouvert={ouvert}
      titre="Importer la liste des CEO"
      onFermer={fermer}
      large
      pied={
        <>
          <Button variante="discret" onClick={fermer}>
            Annuler
          </Button>
          <Button variante="principal" onClick={importer} disabled={!nombre || enCours}>
            <Upload aria-hidden="true" strokeWidth={1.75} />
            Importer {nombre || ""} CEO
          </Button>
        </>
      }
    >
      <div className="grid justify-items-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-filet-fort bg-[#FAFAF9] p-4 text-center">
        <FileSpreadsheet aria-hidden="true" className="size-[26px] text-eau" strokeWidth={1.75} />
        <strong className="font-semibold">Fichier Excel ou CSV</strong>
        <span className="text-[13px] text-texte-secondaire">
          Par exemple la liste du déjeuner du 22 octobre ou la cartographie par maillon. Les colonnes sont reconnues par
          leur titre.
        </span>
        <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-2 overflow-hidden rounded-controle border border-eau bg-eau px-4 text-[15px] font-medium text-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-eau hover:bg-[#163f4b]">
          <Upload aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
          {lecture ? "Lecture du fichier" : "Choisir le fichier"}
          <input
            type="file"
            accept=".xlsx,.csv,.xls"
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(e) => {
              void lireFichier(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <details className="text-[14px]">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-texte-secondaire">
          Ou coller un tableau
        </summary>
        <div className="grid gap-2">
          <p className="text-[13px] text-texte-secondaire">
            Copiez les lignes depuis Excel ou Google Sheets, en-tête compris (au moins une colonne « Entreprise »), et
            collez-les ici.
          </p>
          <textarea
            value={colle}
            onChange={(e) => setColle(e.target.value)}
            className="min-h-28 w-full rounded-controle border border-filet-fort bg-surface p-3 text-[14px] focus:border-eau focus:shadow-[0_0_0_3px_var(--color-eau-doux)] focus:outline-none"
            aria-label="Tableau collé"
            placeholder={"Entreprise\tPrénom\tNom\tFonction\tMaillon\tTéléphone"}
          />
          <div>
            <Button onClick={() => appliquer(lireTexteDelimite(colle), "")} disabled={!colle.trim()}>
              <ScanLine aria-hidden="true" strokeWidth={1.75} />
              Analyser
            </Button>
          </div>
        </div>
      </details>

      {erreur ? (
        <p role="alert" className="text-[13.5px] text-erreur">
          {erreur}
        </p>
      ) : null}

      {colonnes && lignes.length ? (
        <>
          <div className="grid gap-1.5 text-[13.5px]">
            <p>
              {fichier ? <strong className="font-semibold break-all">{fichier} : </strong> : null}
              {lignes.length} ligne{lignes.length > 1 ? "s" : ""} lue{lignes.length > 1 ? "s" : ""}, {nombre} cochée
              {nombre > 1 ? "s" : ""}
              {resume.doublons ? `, ${resume.doublons} déjà dans la liste (décochées)` : ""}
              {resume.sansTel ? `, ${resume.sansTel} sans téléphone` : ""}.
            </p>
            <p className="text-texte-secondaire">
              Colonnes reconnues :{" "}
              {(Object.keys(NOMS_COLONNES) as (keyof ColonnesReconnues)[])
                .filter((k) => colonnes[k])
                .map((k) => `${NOMS_COLONNES[k]} (« ${colonnes[k]} »)`)
                .join(", ")}
              .
            </p>
          </div>
          <ul className="grid overflow-hidden rounded-controle border border-filet">
            {lignes.map((l) => (
              <li key={l.numero} className="border-t border-filet first:border-t-0">
                <label className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-3 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={cochees.has(l.numero)}
                    onChange={() => basculer(l.numero)}
                    className="mt-1 size-5 accent-eau"
                  />
                  <span className="grid min-w-0 gap-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-semibold">
                        {`${l.prenom} ${l.nom}`.trim() || "Dirigeant non renseigné"}
                      </span>
                      <span className="text-[12.5px] text-texte-secondaire">Ligne {l.numero}</span>
                    </span>
                    <span className="text-[13.5px] text-texte-secondaire">
                      {l.entreprise}
                      {l.maillon ? `, ${l.maillon}` : ""}
                      {l.fonction ? `, ${l.fonction}` : ""}
                    </span>
                    <span className="text-[13.5px] text-texte-secondaire tabular-nums">
                      {l.telephone ? formaterTelephone(l.telephone) : l.telephoneIllisible ? `Numéro illisible : ${l.telephoneIllisible}` : ""}
                      {l.email ? `${l.telephone || l.telephoneIllisible ? " · " : ""}${l.email}` : ""}
                    </span>
                    {l.signalements.length ? (
                      <span className="flex flex-wrap gap-1.5">
                        {l.signalements.map((s) => (
                          <Chip key={s} variante={s === "deja_dans_la_liste" ? "erreur" : "argile"}>
                            {LIBELLES_SIGNALEMENTS[s]}
                          </Chip>
                        ))}
                      </span>
                    ) : (
                      <span>
                        <Chip variante="succes">Valide</Chip>
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {resume.sansTel ? (
            <p className="text-[13px] text-texte-secondaire">
              Les CEO sans téléphone sont importés, mais leur lien ne pourra pas être envoyé tant que le numéro manque.
            </p>
          ) : null}
        </>
      ) : null}
    </Modal>
  );
}
