import Link from "next/link";
import { Flame } from "lucide-react";
import { SITE } from "@/config/site";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-xl py-1 pr-2" aria-label={`${SITE.name} home`}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-700 ring-1 ring-gold-200">
        <Flame className="size-5" aria-hidden="true" />
      </span>
      <span className="text-base font-extrabold leading-tight tracking-tight whitespace-nowrap text-ink sm:text-lg">{SITE.name}</span>
    </Link>
  );
}
