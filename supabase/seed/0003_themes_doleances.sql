-- =====================================================================
-- seed/0003_themes_doleances.sql
-- Les 6 thèmes de départ des doléances (cahier des charges, partie 9 ; D23), dans cet ordre.
-- À exécuter après supabase/migrations/0009_doleances.sql.
-- Idempotent : les thèmes ne sont créés que si aucun thème n'existe encore. Une deuxième exécution
-- ne change rien, et un thème renommé, désactivé ou ajouté par un admin reste tel quel.
-- =====================================================================

insert into public.doleance_themes (libelle, ordre)
select v.libelle, v.ordre
from (
  values
    ('Accès aux marchés publics', 1),
    ('Délais de paiement', 2),
    ('Financement et garanties', 3),
    ('Normes et réglementation', 4),
    ('Formation et compétences', 5),
    ('Contenu local', 6)
) as v (libelle, ordre)
where not exists (select 1 from public.doleance_themes);

select libelle, ordre, actif from public.doleance_themes order by ordre, libelle;
