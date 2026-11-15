/*
  HTML des blocs du texte : seulement du texte échappé et la balise strong.
  Rien d'autre n'est jamais produit ni accepté.
*/

const ENTITES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function echapper(texte: string): string {
  return texte.replace(/[&<>"']/g, (c) => ENTITES[c]);
}

const INVERSE: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

/* Texte lisible d'un bloc : balises retirées, entités décodées, espaces réduits */
export function texteBrut(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39);/g, (e) => INVERSE[e])
    .replace(/\s+/g, " ")
    .trim();
}

/*
  Contrôle qu'un HTML de bloc ne contient que du texte échappé et des balises strong.
  Utilisé avant tout affichage : un bloc qui ne respecte pas cette règle est réduit à son texte.
*/
export function htmlSur(html: string): string {
  const sansStrong = html.replace(/<\/?strong>/g, "");
  const propre = !/[<>]/.test(sansStrong) && !/&(?!(amp|lt|gt|quot|#39);)/.test(sansStrong);
  return propre ? html : echapper(texteBrut(html));
}
