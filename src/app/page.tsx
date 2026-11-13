import { Apparition } from "@/components/apparition";

export default function Accueil() {
  return (
    <main
      data-ambiance="ceo"
      className="flex min-h-dvh items-center justify-center px-4 py-12 sm:px-8"
    >
      <Apparition className="w-full max-w-2xl text-center">
        <h1 className="font-titre text-[28px] leading-tight font-normal tracking-[-0.01em] text-balance text-encre sm:text-[40px]">
          Manifeste du secteur privé sénégalais de l&apos;eau et de l&apos;assainissement
        </h1>
        <p className="mt-4 text-[15px] text-texte-secondaire sm:text-base">
          Conférence des Nations Unies sur l&apos;eau · Abu&nbsp;Dhabi, décembre 2026
        </p>
        <div aria-hidden="true" className="mx-auto mt-8 h-0 w-24 border-t-2 border-doc-or" />
        <p className="mt-8 text-base text-encre">
          Cette plateforme est réservée aux dirigeants qui ont reçu un lien personnel.
        </p>
      </Apparition>
    </main>
  );
}
