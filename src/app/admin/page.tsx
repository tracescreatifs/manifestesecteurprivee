import { redirect } from "next/navigation";

/* La rubrique Texte deviendra la page d'arrivée au prompt 03 */
export default function AccueilAdmin() {
  redirect("/admin/reglages");
}
