/*
  Clés du menu réductible de l'admin (R2), partagées par le script du layout racine (exécuté avant l'affichage)
  et par le composant du panneau. Module sans « use client » : la chaîne du script est lue telle quelle par le serveur.
*/

export const CLE_MENU = "manifeste-admin-menu";
export const CLE_APPARITION = "manifeste-admin-apparu";

/* Pose <html data-menu="reduit"> si le menu a été réduit, et <html data-apparition> à la première ouverture de la session */
export const SCRIPT_MENU = `(function(){try{var d=document.documentElement;if(localStorage.getItem("${CLE_MENU}")==="reduit")d.dataset.menu="reduit";if(!sessionStorage.getItem("${CLE_APPARITION}"))d.dataset.apparition="1";}catch(e){}})();`;
