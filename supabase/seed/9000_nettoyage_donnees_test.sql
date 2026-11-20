-- =====================================================================
-- 9000_nettoyage_donnees_test.sql
-- Supprime les données de test (CEO, invitations, signatures en ligne et sur place, commentaires, doléances,
-- consentements, personnes et entreprises de test) avant l'import de la vraie liste.
--
-- MODE D'EMPLOI (SQL Editor de Supabase) :
--   1. Vérifiez la liste des entreprises de test, à l'étape 1 ci-dessous.
--   2. Exécutez le script tel quel : confirmer vaut false, RIEN n'est supprimé.
--      Le résultat affiché est l'aperçu de tout ce qui serait supprimé.
--   3. Si l'aperçu est juste, remplacez false par true à l'étape 1, puis exécutez de nouveau.
--      La suppression se fait en une seule transaction : tout ou rien.
--   4. Les fichiers listés (photos, accusés, signatures sur place, exports) se suppriment ensuite à la main,
--      dans Supabase, Storage (le SQL ne peut pas supprimer proprement les fichiers).
--      Le bucket imports garde les fichiers Word des versions du texte : ne pas y toucher (les versions restent).
--
-- À exécuter après les migrations 0007 et 0009 (ou avant : le script fonctionne dans tous les cas ;
-- sans la table des doléances, la ligne « Doléances » affiche 0).
-- Le journal n'est jamais modifié. Seules les entreprises de la liste sont supprimées.
-- Si plus aucune signature n'existe après la suppression et qu'aucun accusé ne reste dans Storage, les références
-- repartent de MSP-2026-0001 (sinon : supprimer les accusés listés, puis exécuter de nouveau avec confirmer = true).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Paramètres : entreprises de test (comparées sans tenir compte des majuscules,
--    des accents, des points ni des formes juridiques), et confirmation.
-- ---------------------------------------------------------------------
drop table if exists pg_temp.nettoyage_parametres;
-- À vérifier par Ziza (audit 06b), NON incluses : noms d'entreprises des données de démonstration des prototypes
-- ('Forages du Ndiambour', 'Kane Forages', 'Niayes Hydro'). Si l'une d'elles a été saisie pour un essai et ne
-- figure pas dans la vraie liste, ajoutez-la au tableau ci-dessous avant de confirmer.
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
-- Signatures en ligne des invitations de test, et signataires sur place (prompt 08) des entreprises de test
create temp table nettoyage_signatures as
select s.id, s.reference, s.origine::text as origine, s.image_path
from public.signatures s
where s.invitation_id in (select id from nettoyage_invitations)
   or (s.origine = 'sur_place' and public.normaliser_nom_entreprise(coalesce(s.entreprise_nom, '')) in (
         select public.normaliser_nom_entreprise(n) from nettoyage_parametres, unnest(entreprises_test) as n
       ));

drop table if exists pg_temp.nettoyage_commentaires;
create temp table nettoyage_commentaires as
select c.id from public.commentaires c where c.invitation_id in (select id from nettoyage_invitations);

-- Doléances (migration 0009) : lues seulement si la table existe
drop table if exists pg_temp.nettoyage_doleances;
create temp table nettoyage_doleances (id uuid);
do $$
begin
  if to_regclass('public.doleances') is not null then
    execute 'insert into nettoyage_doleances (id)
             select d.id from public.doleances d where d.invitation_id in (select id from nettoyage_invitations)';
  end if;
end;
$$;

-- Fichiers du bucket exports (PDF du document final déposés lors d'un essai de publication) : avant l'envoi
-- des liens, tout fichier de ce bucket est un essai. Lus seulement si le schéma storage existe.
drop table if exists pg_temp.nettoyage_exports;
create temp table nettoyage_exports (nom text);
do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'insert into nettoyage_exports (nom) select name from storage.objects where bucket_id = ''exports''';
  end if;
end;
$$;

-- Accusés encore rangés dans le bucket accuses (lus seulement si le schéma storage existe)
drop table if exists pg_temp.nettoyage_accuses_restants;
create temp table nettoyage_accuses_restants (nom text);
do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'insert into nettoyage_accuses_restants (nom) select name from storage.objects where bucket_id = ''accuses''';
  end if;
end;
$$;

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
  if to_regclass('public.doleances') is not null then
    execute 'delete from public.doleances where id in (select id from nettoyage_doleances)';
  end if;
  delete from public.consentements where id in (select id from nettoyage_consentements);
  delete from public.invitations where id in (select id from nettoyage_invitations);
  delete from public.personnes where id in (select id from nettoyage_personnes);
  delete from public.entreprises where id in (select id from nettoyage_entreprises);

  -- Plus aucune signature : la prochaine référence sera MSP-2026-0001, mais seulement quand plus aucun accusé
  -- n'est rangé dans Storage (audit 06b). Sinon, le premier vrai signataire recevrait l'accusé de test qui porte
  -- la même référence. Supprimez d'abord les accusés listés, puis exécutez de nouveau ce script (confirmer = true).
  if not exists (select 1 from public.signatures) and not exists (select 1 from nettoyage_accuses_restants) then
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
  select 6.5, 'Doléances', count(*), null
  from nettoyage_doleances
  union all
  select 7, 'Fichiers à supprimer à la main : bucket photos', count(photo_path), string_agg(photo_path, ', ')
  from nettoyage_personnes
  union all
  select 8, 'Fichiers à supprimer à la main : bucket accuses', count(*), string_agg(reference || '.pdf', ', ' order by reference)
  from nettoyage_signatures
  where origine = 'en_ligne'
  union all
  select 8.5, 'Fichiers à supprimer à la main : bucket signatures (sur place)', count(image_path), string_agg(image_path, ', ' order by image_path)
  from nettoyage_signatures
  union all
  select 8.6, 'Accusés encore dans Storage sans signature (à supprimer à la main)', count(*), string_agg(nom, ', ' order by nom)
  from nettoyage_accuses_restants
  where nom not in (select s.reference || '.pdf' from public.signatures s where s.id not in (select id from nettoyage_signatures))
  union all
  select 8.7, 'Fichiers à supprimer à la main : bucket exports (essais de publication)', count(*), string_agg(nom, ', ' order by nom)
  from nettoyage_exports
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
        || case
             when not exists (select 1 from public.signatures) and exists (select 1 from nettoyage_accuses_restants)
               then ' (repartira de MSP-2026-0001 après la suppression des accusés dans Storage et une nouvelle exécution)'
             else ''
           end
      else 'Calculée après la suppression'
    end
) bilan
order by ordre;
