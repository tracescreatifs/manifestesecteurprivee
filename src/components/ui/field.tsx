import type { ReactNode } from "react";

type Props = {
  id: string;
  libelle: string;
  aide?: string;
  erreur?: string;
  children: ReactNode;
  className?: string;
};

/* Champ de formulaire : libellé, contrôle, aide et erreur */
export function Field({ id, libelle, aide, erreur, children, className = "" }: Props) {
  return (
    <div className={`grid gap-2 ${className}`}>
      <label htmlFor={id} className="text-[13px] font-medium text-texte-secondaire">
        {libelle}
      </label>
      {children}
      {aide && !erreur ? <p className="text-[13px] text-texte-secondaire">{aide}</p> : null}
      {erreur ? (
        <p className="text-[13px] text-erreur" role="alert">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
