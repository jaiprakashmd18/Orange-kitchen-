import Image from "next/image";
import Link from "next/link";

/** Default brand assets supplied by Orange Kitchen (public/brand). */
export const BRAND_LOGO = "/brand/logo.webp";
export const BRAND_MASCOT = "/brand/mascot.webp";

/**
 * Header/footer brand mark: the chef-orange mascot with the ORANGE KITCHEN
 * wordmark (as in the official logo). If a different logo is uploaded in
 * Admin → Settings, that image is shown instead.
 */
export function Logo({ logoUrl, name, className = "", light = false }: { logoUrl: string | null; name: string; className?: string; light?: boolean }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 ${className}`} aria-label={`${name} home`}>
      {logoUrl ? (
        <Image src={logoUrl} alt={`${name} logo`} width={160} height={56} className="h-11 w-auto object-contain sm:h-14" priority unoptimized={logoUrl.endsWith(".svg")} />
      ) : (
        <>
          <Image src={BRAND_MASCOT} alt="" width={56} height={56} className="h-11 w-11 rounded-full bg-cream object-cover ring-2 ring-brand-200 sm:h-12 sm:w-12" priority />
          <span className="flex flex-col font-display leading-[0.95]">
            <span className="text-xl font-bold tracking-wide text-brand-500 sm:text-2xl">ORANGE</span>
            <span className={`text-[0.8rem] font-semibold tracking-[0.32em] sm:text-sm ${light ? "text-white" : "text-charcoal"}`}>KITCHEN</span>
          </span>
        </>
      )}
    </Link>
  );
}
