"use client";

import { LogOut } from "lucide-react";

import { deconnexion } from "@/app/(auth)/actions";
import { MenuActions } from "@/components/ui/menu-actions";

/*
  Initiales de l'admin connecté, avec un menu qui contient « Se déconnecter ».
  bloc (R1, bas du panneau latéral) : initiales, nom et adresse ; la fonction de l'admin n'est pas connue en base.
*/
export function MenuAdmin({ prenom, nom, email, bloc = false }: { prenom: string; nom: string; email: string; bloc?: boolean }) {
  const initiales = `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
  const pastille = (
    <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-eau text-[13px] font-semibold text-white">
      {initiales}
    </span>
  );

  return (
    <MenuActions
      libelle={`Compte de ${prenom} ${nom}`}
      elements={[]}
      classeDeclencheur={
        bloc
          ? "flex min-h-14 w-full min-w-0 items-center gap-2.5 rounded-controle px-2.5 py-2 text-left hover:bg-[rgba(20,33,43,0.05)]"
          : "grid size-11 place-items-center rounded-full"
      }
      declencheur={
        bloc ? (
          <>
            {pastille}
            <span className="grid min-w-0 leading-tight">
              <span className="truncate text-[14px] font-medium">
                {prenom} {nom}
              </span>
              <span className="truncate text-[12.5px] text-texte-secondaire">{email}</span>
            </span>
          </>
        ) : (
          pastille
        )
      }
      entete={
        <div className="px-2.5 py-2">
          <p className="font-medium">
            {prenom} {nom}
          </p>
          <p className="text-[13px] break-all text-texte-secondaire">{email}</p>
        </div>
      }
      pied={
        <form action={deconnexion}>
          <button
            type="submit"
            role="menuitem"
            tabIndex={-1}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[14px] hover:bg-sureleve focus:bg-sureleve focus:outline-none"
          >
            <LogOut aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
            Se déconnecter
          </button>
        </form>
      }
    />
  );
}
