"use client";

import { LogOut } from "lucide-react";

import { deconnexion } from "@/app/(auth)/actions";
import { MenuActions } from "@/components/ui/menu-actions";

/* Initiales de l'admin connecté, avec un menu qui contient « Se déconnecter » */
export function MenuAdmin({ prenom, nom, email }: { prenom: string; nom: string; email: string }) {
  const initiales = `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();

  return (
    <MenuActions
      libelle={`Compte de ${prenom} ${nom}`}
      elements={[]}
      classeDeclencheur="grid size-11 place-items-center rounded-full"
      declencheur={
        <span className="grid size-[30px] place-items-center rounded-full bg-eau text-[13px] font-semibold text-white">
          {initiales}
        </span>
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
