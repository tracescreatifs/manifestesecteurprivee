-- =====================================================================
-- seed/0002_modele_message_whatsapp.sql
-- Modèle du message WhatsApp aux CEO, mis en forme pour WhatsApp (prompt 06.1, D101) :
-- nom du Manifeste et date limite en gras, signature de la Task Force en italique, lien jamais mis en forme.
-- À exécuter après supabase/migrations/0008_inscription_anti_doublon.sql.
--
-- Le modèle en base n'est remplacé QUE s'il est encore exactement l'ancien modèle d'origine (seed 0001).
-- S'il a été modifié par un admin (Réglages, Messages), rien n'est touché : un message le signale.
-- Idempotent : une deuxième exécution ne change rien et ne provoque aucune erreur.
-- =====================================================================

do $$
declare
  ancien constant text := E'Bonjour {prenom},\n\nSuite au déjeuner du 22 octobre, voici le Manifeste du secteur privé sénégalais de l\'eau et de l\'assainissement, qui sera présenté à Abu Dhabi.\n\nVous pouvez le lire, le commenter et le signer en deux minutes, depuis votre téléphone ou votre ordinateur, avec ce lien personnel :\n{lien}\n\nMerci de signer avant le {date_limite} pour figurer dans l\'exemplaire imprimé pour Abu Dhabi. Une question ? Répondez simplement à ce message.\n\nLa Task Force du secteur privé sénégalais de l\'eau et de l\'assainissement';
  nouveau constant text := E'Bonjour {prenom},\n\nSuite au déjeuner du 22 octobre, voici le *Manifeste du secteur privé sénégalais de l\'eau et de l\'assainissement*, qui sera présenté à Abu Dhabi.\n\nVous pouvez le lire, le commenter et le signer en deux minutes, depuis votre téléphone ou votre ordinateur, avec ce lien personnel :\n{lien}\n\n*Merci de signer avant le {date_limite}* pour figurer dans l\'exemplaire imprimé pour Abu Dhabi.\n\nUne question ? Répondez simplement à ce message.\n\n_La Task Force du secteur privé sénégalais de l\'eau et de l\'assainissement_';
  n integer;
begin
  update public.manifestes
  set modele_message_whatsapp = nouveau
  where modele_message_whatsapp = ancien;
  get diagnostics n = row_count;

  if n > 0 then
    raise notice 'Modèle du message WhatsApp remplacé par le modèle mis en forme.';
  elsif exists (select 1 from public.manifestes where modele_message_whatsapp is distinct from nouveau) then
    raise notice 'Le modèle en base a été modifié par un admin : il n''est pas remplacé. Pour adopter le nouveau modèle, cliquez sur « Revenir au modèle d''origine » dans Réglages, Messages, puis Enregistrer.';
  else
    raise notice 'Le modèle mis en forme est déjà en place : rien à faire.';
  end if;
end $$;

-- Résultat lisible dans le SQL Editor
select
  case
    when modele_message_whatsapp = E'Bonjour {prenom},\n\nSuite au déjeuner du 22 octobre, voici le *Manifeste du secteur privé sénégalais de l\'eau et de l\'assainissement*, qui sera présenté à Abu Dhabi.\n\nVous pouvez le lire, le commenter et le signer en deux minutes, depuis votre téléphone ou votre ordinateur, avec ce lien personnel :\n{lien}\n\n*Merci de signer avant le {date_limite}* pour figurer dans l\'exemplaire imprimé pour Abu Dhabi.\n\nUne question ? Répondez simplement à ce message.\n\n_La Task Force du secteur privé sénégalais de l\'eau et de l\'assainissement_' then 'Modèle mis en forme en place'
    else 'Modèle conservé : il a été modifié par un admin'
  end as resultat
from public.manifestes;
