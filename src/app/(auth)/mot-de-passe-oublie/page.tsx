import type { Metadata } from "next";

import { CarteAuth } from "@/components/admin/carte-auth";

import { FormulaireMotDePasseOublie } from "./formulaire";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function PageMotDePasseOublie() {
  return (
    <CarteAuth surtitre="Espace admin" titre="Mot de passe oublié">
      <FormulaireMotDePasseOublie />
    </CarteAuth>
  );
}
