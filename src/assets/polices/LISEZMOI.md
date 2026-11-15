# Polices rangées dans le dépôt

- Fraunces et Jost : sous-ensembles limités aux caractères du titre et du sous-titre,
  utilisés par `src/app/opengraph-image.tsx` (next/og ne lit que les polices TTF ou OTF).
- Gelasio (normal) et Carlito (normal, gras, italique) : sous-ensembles latins (latin étendu, ponctuation),
  intégrés à l'accusé de signature en PDF (`src/lib/signature/accuse-pdf.ts`, D74).

Toutes viennent de Google Fonts. Licence : SIL Open Font License 1.1 (https://openfontlicense.org).
