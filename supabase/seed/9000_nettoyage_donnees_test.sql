-- =====================================================================
-- 9000_nettoyage_donnees_test.sql
-- Supprime les données de test (CEO, invitations, signatures, commentaires,
-- consentements, personnes et entreprises de test) avant l'import de la vraie liste.
--
-- MODE D'EMPLOI (SQL Editor de Supabase) :
--   1. Vérifiez la liste des entreprises de test, à l'étape 1 ci-dessous.
--   2. Exécutez le script tel quel : confirmer vaut false, RIEN n'est supprimé.
--      Le résultat affiché est l'aperçu de tout ce qui serait supprimé.
--   3. Si l'aperçu est juste, remplacez false par true à l'étape 1, puis exécutez de nouveau.
--      La suppression se fait en une seule transaction : tout ou rien.
--   4. Les fichiers listés (photos et accusés) se suppriment ensuite à la main,
--      dans Supabase, Storage (le SQL ne peut pas supprimer proprement les fichiers).
--
-- À exécuter après la migration 0007 (ou avant : le script fonctionne dans les deux cas).
-- Le journal n'est jamais modifié. Seules les entreprises de la liste sont supprimées.
-- Si plus aucune signature n'existe après la suppression, les références repartent
-- de MSP-2026-0001.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Paramètres : entreprises de test (comparées sans tenir compte des majuscules,
--    des accents, des points ni des formes juridiques), et confirmation.
-- ---------------------------------------------------------------------
drop table if exists pg_temp.nettoyage_parametres;
create temp table nettoyage_parametres as
select
  array['Test Forages', 'water', 'Test QR', 'Test Parrainage']::text[] as entreprises_test,
  false as confirmer;


-- ---------------------------------------------------------------------
-- 2. Cibles (aucune suppression ici)
-- ---------------------------------------------------------------------
drop table if exists pg_temp.nettoyage_entreprises;
create temp table nettoyage_entreprises as
select e.id, e.nom
from public.entreprises e
where e.nom_normalise in (
  select public.normaliser_nom_entreprise(n) from nettoyage_parametres, unnest(entreprises_test) as n
);

-- Invitations rattachées à une entreprise de test, directement ou par la personne
drop table if exists pg_temp.nettoyage_invitations;
create temp table nettoyage_invitations as
select i.id, i.personne_id, i.jeton
from public.invitations i
where i.entreprise_id in (select id from nettoyage_entreprises)
   or i.personne_id in (
     select p.id from public.personnes p where p.entreprise_id in (select id from nettoyage_entreprises)
   );

-- Personnes de test : seulement si toutes leurs invitations sont des invitations de test
drop table if exists pg_temp.nettoyage_personnes;
create temp table nettoyage_personnes as
select p.id, p.prenom, p.nom, p.photo_path
from public.personnes p
where (p.entreprise_id in (select id from nettoyage_entreprises)
       or p.id in (select personne_id from nettoyage_invitations))
  and not exists (
    select 1 from public.invitations i
    where i.personne_id = p.id and i.id not in (select id from nettoyage_invitations)
  );

drop table if exists pg_temp.nettoyage_signatures;
create temp table nettoyage_signatures as
select s.id, s.reference
from public.signatures s
where s.invitation_id in (select id from nettoyage_invitations);

drop table if exists pg_temp.nettoyage_commentaires;
create temp table nettoyage_commentaires as
select c.id from public.commentaires c where c.invitation_id in (select id from nettoyage_invitations);

drop table if exists pg_temp.nettoyage_consentements;
create temp table nettoyage_consentements as
select k.id from public.consentements k where k.personne_id in (select id from nettoyage_personnes);


-- ---------------------------------------------------------------------
-- 3. Suppression, seulement si confirmer vaut true. Un bloc DO est une seule
--    transaction : en cas d'erreur, rien n'est supprimé.
-- ---------------------------------------------------------------------
do $$
declare
  v_confirmer boolean;
begin
  select confirmer into v_confirmer from nettoyage_parametres;
  if not v_confirmer then
    return;
  end if;

  -- Une signature n'est jamais supprimée (trigger de la migration 0007), sauf ici : le trigger
  -- est désactivé le temps de cette transaction, puis réactivé
  if exists (select 1 from pg_trigger where tgname = 'signatures_non_supprimees') then
    alter table public.signatures disable trigger signatures_non_supprimees;
  end if;
  delete from public.signatures where id in (select id from nettoyage_signatures);
  if exists (select 1 from pg_trigger where tgname = 'signatures_non_supprimees') then
    alter table public.signatures enable trigger signatures_non_supprimees;
  end if;
  delete from public.commentaires where id in (select id from nettoyage_commentaires);
  delete from public.consentements where id in (select id from nettoyage_consentements);
  delete from public.invitations where id in (select id from nettoyage_invitations);
  delete from public.personnes where id in (select id from nettoyage_personnes);
  delete from public.entreprises where id in (select id from nettoyage_entreprises);

  -- Plus aucune signature : la prochaine référence sera MSP-2026-0001
  if not exists (select 1 from public.signatures) then
    perform setval('public.signature_reference_seq', 1, false);
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Résultat : aperçu (confirmer = false) ou bilan de la suppression (confirmer = true)
-- ---------------------------------------------------------------------
select
  case when (select confirmer from nettoyage_parametres) then 'Supprimé' else 'Aperçu, rien supprimé' end as etat,
  quoi,
  nombre,
  detail
from (
  select 1 as ordre, 'Entreprises' as quoi, count(*) as nombre, string_agg(nom, ', ' order by nom) as detail
  from nettoyage_entreprises
  union all
  select 2, 'Personnes', count(*), string_agg(prenom || ' ' || nom, ', ' order by nom)
  from nettoyage_personnes
  union all
  select 3, 'Invitations', count(*), null
  from nettoyage_invitations
  union all
  select 4, 'Signatures', count(*), string_agg(reference, ', ' order by reference)
  from nettoyage_signatures
  union all
  select 5, 'Commentaires', count(*), null
  from nettoyage_commentaires
  union all
  select 6, 'Consentements', count(*), null
  from nettoyage_consentements
  union all
  select 7, 'Fichiers à supprimer à la main : bucket photos', count(photo_path), string_agg(photo_path, ', ')
  from nettoyage_personnes
  union all
  select 8, 'Fichiers à supprimer à la main : bucket accuses', count(*), string_agg(reference || '.pdf', ', ' order by reference)
  from nettoyage_signatures
  union all
  select 9, 'Signatures restantes (hors test)', count(*), string_agg(reference, ', ' order by reference)
  from public.signatures s
  where s.id not in (select id from nettoyage_signatures)
  union all
  select 10, 'Prochaine référence',
    null,
    case
      when (select confirmer from nettoyage_parametres) then
        (select 'MSP-2026-' || case when n < 10000 then lpad(n::text, 4, '0') else n::text end
         from (select case when is_called then last_value + 1 else last_value end as n from public.signature_reference_seq) x)
      else 'Calculée après la suppression'
    end
) bilan
order by ordre;
