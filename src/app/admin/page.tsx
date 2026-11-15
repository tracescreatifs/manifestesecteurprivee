import { redirect } from "next/navigation";

/* Page d'arrivée de l'espace admin : la rubrique Texte */
export default function AccueilAdmin() {
  redirect("/admin/texte");
}
