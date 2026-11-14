import type { ButtonHTMLAttributes } from "react";

export type VarianteBouton = "principal" | "secondaire" | "discret" | "danger";

const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border px-4 text-[15px] font-medium whitespace-nowrap " +
  "transition-[background-color,border-color,transform] duration-150 ease-projet active:scale-[0.98] " +
  "disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 [&_svg]:size-[18px] [&_svg]:shrink-0";

const VARIANTES: Record<VarianteBouton, string> = {
  principal: "border-eau bg-eau text-white hover:border-[#163f4b] hover:bg-[#163f4b]",
  secondaire: "border-filet-fort bg-surface text-encre hover:border-encre",
  discret: "border-transparent bg-transparent text-encre hover:bg-[rgba(20,33,43,0.06)]",
  danger: "border-erreur bg-erreur text-white hover:opacity-90",
};

/* Classes d'un bouton, pour un lien qui doit en avoir l'apparence */
export function classesBouton(variante: VarianteBouton = "secondaire", extra = "") {
  return `${BASE} ${VARIANTES[variante]} ${extra}`.trim();
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBouton };

export function Button({ variante = "secondaire", className = "", type = "button", ...reste }: Props) {
  return <button type={type} className={classesBouton(variante, className)} {...reste} />;
}
