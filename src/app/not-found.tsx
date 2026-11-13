export default function PageIntrouvable() {
  return (
    <main
      data-ambiance="ceo"
      className="flex min-h-dvh items-center justify-center px-4 py-12 sm:px-8"
    >
      <div className="w-full max-w-xl text-center">
        <h1 className="font-titre text-[26px] leading-tight font-normal tracking-[-0.01em] text-balance text-encre sm:text-[32px]">
          Cette page n&apos;existe pas
        </h1>
        <div aria-hidden="true" className="mx-auto mt-6 h-0 w-24 border-t-2 border-doc-or" />
        <p className="mt-6 text-base text-texte-secondaire">
          Si vous avez reçu un lien personnel, vérifiez qu&apos;il est complet.
        </p>
      </div>
    </main>
  );
}
