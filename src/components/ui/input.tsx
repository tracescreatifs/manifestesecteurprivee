import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...reste }: Props) {
  return (
    <input
      className={
        "min-h-11 w-full rounded-controle border border-filet-fort bg-surface px-3 text-base text-encre " +
        "placeholder:text-texte-secondaire/70 focus:border-eau focus:shadow-[0_0_0_3px_var(--color-eau-doux)] focus:outline-none " +
        className
      }
      {...reste}
    />
  );
}
