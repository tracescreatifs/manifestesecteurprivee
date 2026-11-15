import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { classesBouton } from "@/components/ui/button";
import { formaterDateHeure } from "@/lib/dates";
import { libelleAction } from "@/lib/journal-libelles";
import { creerClientServeur } from "@/lib/supabase/server";

const PAR_PAGE = 50;

/* Journal des actions, le plus récent en premier, 50 lignes par page */
export async function OngletJournal({ page }: { page: number }) {
  const numero = Number.isInteger(page) && page > 0 ? page : 1;
  const debut = (numero - 1) * PAR_PAGE;

  const supabase = await creerClientServeur();
  const [{ data: lignes, count, error }, { data: admins }] = await Promise.all([
    supabase
      .from("journal")
      .select("id, acteur_type, acteur_id, action, cible_type, cible_id, details, cree_le", { count: "exact" })
      .order("cree_le", { ascending: false })
      .order("id", { ascending: false })
      .range(debut, debut + PAR_PAGE - 1),
    supabase.from("admins").select("user_id, prenom, nom"),
  ]);

  if (error) {
    return (
      <p role="alert" className="text-erreur">
        Le journal n&apos;a pas pu être chargé. Rechargez la page.
      </p>
    );
  }

  const noms = new Map((admins ?? []).map((a) => [a.user_id, `${a.prenom} ${a.nom}`]));
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));

  const acteur = (type: string, id: string | null) => {
    if (type === "systeme") return "Système";
    if (type === "admin") return (id && noms.get(id)) || "Admin supprimé";
    return "CEO";
  };

  const cible = (type: string | null, id: string | null, details: unknown) => {
    if (type === "admin") {
      const nom = id ? noms.get(id) : undefined;
      if (nom) return nom;
      const email = (details as { email?: string } | null)?.email;
      return email ?? "";
    }
    if (type === "version") {
      const numero = (details as { numero?: number } | null)?.numero;
      return numero ? `version ${numero}` : "";
    }
    return "";
  };

  return (
    <section className="grid gap-3 rounded-[14px] border border-filet bg-surface p-6">
      <h3 className="font-titre text-xl font-normal">Journal</h3>
      {lignes && lignes.length > 0 ? (
        <ol className="grid text-[14px]">
          {lignes.map((l) => {
            const texteCible = cible(l.cible_type, l.cible_id, l.details);
            return (
              <li
                key={l.id}
                className="grid gap-0.5 border-t border-filet py-2 first:border-t-0 min-[820px]:grid-cols-[170px_160px_minmax(0,1fr)] min-[820px]:gap-3"
              >
                <time dateTime={l.cree_le} className="text-texte-secondaire tabular-nums">
                  {formaterDateHeure(l.cree_le)}
                </time>
                <strong className="font-semibold">{acteur(l.acteur_type, l.acteur_id)}</strong>
                <span>
                  {libelleAction(l.action)}
                  {texteCible ? <span className="text-texte-secondaire"> : {texteCible}</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="py-6 text-center text-texte-secondaire">Aucune action pour l&apos;instant.</p>
      )}

      {pages > 1 ? (
        <nav aria-label="Pages du journal" className="flex flex-wrap items-center justify-between gap-2 pt-2">
          {numero > 1 ? (
            <Link href={`/admin/reglages?onglet=journal&page=${numero - 1}`} className={classesBouton("secondaire")}>
              <ChevronLeft aria-hidden="true" strokeWidth={1.75} />
              Plus récentes
            </Link>
          ) : (
            <span />
          )}
          <span className="text-[13px] text-texte-secondaire">
            Page {Math.min(numero, pages)} sur {pages}
          </span>
          {numero < pages ? (
            <Link href={`/admin/reglages?onglet=journal&page=${numero + 1}`} className={classesBouton("secondaire")}>
              Plus anciennes
              <ChevronRight aria-hidden="true" strokeWidth={1.75} />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}
