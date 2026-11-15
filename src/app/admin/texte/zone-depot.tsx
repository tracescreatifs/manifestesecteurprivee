"use client";

import { FileUp, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent } from "react";

const TAILLE_MAX = 5 * 1024 * 1024;

/*
  Dépôt du fichier Word téléchargé depuis le Google Doc.
  Le fichier part au serveur, qui le contrôle et le range, puis l'écran « Vérifier l'import » s'ouvre.
*/
export function ZoneDepot({ titre }: { titre: string }) {
  const router = useRouter();
  const champ = useRef<HTMLInputElement>(null);
  const [survol, setSurvol] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string>();

  const envoyer = async (fichier: File | undefined) => {
    if (!fichier || envoi) return;
    setErreur(undefined);
    if (/\.doc$/i.test(fichier.name)) return setErreur("Ce fichier est au format .doc : enregistrez le fichier au format .docx.");
    if (!/\.docx$/i.test(fichier.name)) return setErreur("Choisissez un fichier Word (.docx) téléchargé depuis le Google Doc.");
    if (fichier.size > TAILLE_MAX) return setErreur("Le fichier dépasse 5 Mo. Un texte du Manifeste pèse bien moins : vérifiez le fichier.");

    setEnvoi(true);
    try {
      const donnees = new FormData();
      donnees.append("fichier", fichier);
      const reponse = await fetch("/admin/texte/import", { method: "POST", body: donnees });
      const resultat = (await reponse.json().catch(() => null)) as { ok: boolean; id?: string; erreur?: string } | null;
      if (!resultat?.ok || !resultat.id) {
        setErreur(
          resultat?.erreur ??
            (reponse.status === 413 ? "Le fichier est trop lourd pour être envoyé." : "L'envoi a échoué. Réessayez."),
        );
        setEnvoi(false);
        return;
      }
      router.push(`/admin/texte/verifier?f=${resultat.id}`);
    } catch {
      setErreur("L'envoi a échoué : vérifiez la connexion, puis réessayez.");
      setEnvoi(false);
    } finally {
      if (champ.current) champ.current.value = "";
    }
  };

  const surDepot = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setSurvol(false);
    void envoyer(e.dataTransfer.files[0]);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setSurvol(true);
      }}
      onDragLeave={() => setSurvol(false)}
      onDrop={surDepot}
      className={
        "grid justify-items-center gap-2.5 rounded-xl border-[1.5px] border-dashed p-5 text-center transition-colors duration-150 ease-projet " +
        (survol ? "border-eau bg-eau-doux" : "border-filet-fort bg-[#FAFAF9]")
      }
    >
      <FileUp aria-hidden="true" className="size-[26px] text-eau" strokeWidth={1.75} />
      <strong className="font-semibold">{titre}</strong>
      <span className="text-[13px] text-texte-secondaire">
        Fichier Word téléchargé depuis le Google Doc (Fichier, Télécharger, Microsoft Word).
      </span>
      <label
        className={
          "relative inline-flex min-h-11 cursor-pointer items-center gap-2 overflow-hidden rounded-[10px] border border-eau bg-eau px-4 text-[15px] font-medium text-white hover:bg-[#163f4b] " +
          "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-eau " +
          (envoi ? "pointer-events-none opacity-60" : "")
        }
      >
        <Upload aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
        {envoi ? "Lecture du fichier" : "Choisir le fichier .docx"}
        <input
          ref={champ}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(e) => void envoyer(e.target.files?.[0])}
          disabled={envoi}
        />
      </label>
      <span className="text-[13px] text-texte-secondaire">ou glissez-le ici</span>
      {erreur ? (
        <p role="alert" className="text-[13.5px] text-erreur">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
