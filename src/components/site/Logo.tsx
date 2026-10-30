import Image from "next/image";
import Link from "next/link";

/**
 * Renders the restaurant's uploaded logo (Admin → Settings → Logo).
 * Until a logo is uploaded, a typographic wordmark is shown instead —
 * no substitute logo artwork is generated.
 */
export function Logo({ logoUrl, name, className = "", light = false }: { logoUrl: string | null; name: string; className?: string; light?: boolean }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 ${className}`} aria-label={`${name} home`}>
      {logoUrl ? (
        <Image src={logoUrl} alt={`${name} logo`} width={160} height={48} className="h-10 w-auto object-contain sm:h-12" priority unoptimized={logoUrl.endsWith(".svg")} />
      ) : (
        <span className="flex flex-col leading-none">
          <span className={`font-display text-xl font-bold tracking-wide sm:text-2xl ${light ? "text-white" : "text-charcoal"}`}>
            <span className="text-brand-500">ORANGE</span> KITCHEN
          </span>
        </span>
      )}
    </Link>
  );
}
