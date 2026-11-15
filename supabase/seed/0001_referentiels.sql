-- =====================================================================
-- seed/0001_referentiels.sql
-- Données de départ : pays, maillons, et la ligne du Manifeste.
-- À exécuter après supabase/migrations/0001_fondations.sql.
-- Idempotent : une deuxième exécution ne change rien et ne provoque aucune erreur.
-- Aucune version du texte : la version 1 viendra du premier import Word.
-- =====================================================================

-- Pays
insert into public.pays (code, nom)
values ('SN', 'Sénégal')
on conflict (code) do nothing;

-- Maillons de la chaîne de valeur (cahier des charges, partie 11), dans cet ordre
insert into public.maillons (libelle, description, ordre)
values
  ('Études', 'Bureaux d''études, ingénierie, conception, maîtrise d''œuvre', 1),
  ('Production', 'Forage, captage, mobilisation de la ressource', 2),
  ('Transport et distribution', 'Réseaux, canalisations, matériels hydrauliques, génie civil', 3),
  ('Traitement et valorisation', 'Assainissement, traitement des effluents, réutilisation', 4),
  ('Axes transversaux', 'Activités au service de toute la chaîne', 5)
on conflict (libelle) do nothing;

-- Le Manifeste : une seule ligne, créée seulement si la table est vide
insert into public.manifestes (titre, sous_titre, date_limite, texte_consentement, modele_message_whatsapp)
select
  'Manifeste du secteur privé sénégalais de l''eau et de l''assainissement',
  'Conférence des Nations Unies sur l''eau · Abu Dhabi, décembre 2026',
  '2026-12-02 23:59:00+00',
  -- Texte de consentement par défaut (cahier des charges, partie 11)
  'J''accepte que mon nom, ma fonction, le nom de mon entreprise et ma signature figurent dans le Manifeste et dans sa diffusion publique.',
  -- Modèle du message WhatsApp d'origine, repris exactement du prototype (1-admin.html, constante MODELE).
  -- Remplacé par le modèle mis en forme du seed 0002, seulement s'il n'a pas été modifié par un admin.
  E'Bonjour {prenom},\n\nSuite au déjeuner du 22 octobre, voici le Manifeste du secteur privé sénégalais de l\'eau et de l\'assainissement, qui sera présenté à Abu Dhabi.\n\nVous pouvez le lire, le commenter et le signer en deux minutes, depuis votre téléphone ou votre ordinateur, avec ce lien personnel :\n{lien}\n\nMerci de signer avant le {date_limite} pour figurer dans l\'exemplaire imprimé pour Abu Dhabi. Une question ? Répondez simplement à ce message.\n\nLa Task Force du secteur privé sénégalais de l\'eau et de l\'assainissement'
where not exists (select 1 from public.manifestes);
