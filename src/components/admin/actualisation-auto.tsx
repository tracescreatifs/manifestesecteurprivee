"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { heureDakar } from "@/lib/admin/calculs";

/* Mise à jour en continu (D117), partagée par la rubrique Document A4 et le tableau de bord (R1) */
const INTERVALLE_ACTUALISATION = 30_000;

/*
  Relecture périodique (router.refresh) : seulement quand l'onglet est visible ; reprise immédiate au retour.
  Les composants clients gardent leur état et la page garde sa position.
*/
export function ActualisationAuto({ lueLe }: { lueLe: string }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const actualiser = () => demarrer(() => router.refresh());

  useEffect(() => {
    let minuterie: number | undefined;
    const arreter = () => window.clearInterval(minuterie);
    const lancer = () => {
      arreter();
      minuterie = window.setInterval(() => router.refresh(), INTERVALLE_ACTUALISATION);
    };
    const surVisibilite = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        lancer();
      } else arreter();
    };
    if (document.visibilityState === "visible") lancer();
    document.addEventListener("visibilitychange", surVisibilite);
    return () => {
      arreter();
      document.removeEventListener("visibilitychange", surVisibilite);
    };
  }, [router]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-[13.5px] text-texte-secondaire">
      <p aria-live="polite">Mis à jour à {heureDakar(lueLe)}</p>
      <Button variante="discret" className="min-h-11 px-3 text-[14px]" onClick={actualiser} disabled={enCours}>
        <RefreshCw aria-hidden="true" strokeWidth={1.75} />
        Actualiser
      </Button>
    </div>
  );
}
