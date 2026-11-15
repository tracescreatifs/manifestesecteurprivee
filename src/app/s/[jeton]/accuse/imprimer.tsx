"use client";

import { FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";

/* Le PDF est produit par l'impression du navigateur, au format A4 (« Enregistrer au format PDF ») */
export function BoutonImprimer() {
  return (
    <Button variante="principal" onClick={() => window.print()}>
      <FileDown aria-hidden="true" strokeWidth={1.75} />
      Télécharger mon accusé
    </Button>
  );
}
