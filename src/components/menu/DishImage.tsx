import Image from "next/image";

/** Food photo, or a warm neutral placeholder until the restaurant uploads one. */
export function DishImage({ src, alt, className = "", sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw", priority = false, representative = false }: {
  src: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** auto-sourced stock photo: labelled so customers know it isn't the actual plate */
  representative?: boolean;
}) {
  if (src) {
    return (
      <div className={`relative overflow-hidden bg-cream-200 ${className}`}>
        <Image src={src} alt={representative ? `${alt} (representative image)` : alt} fill sizes={sizes} priority={priority} className="object-cover transition duration-500 group-hover:scale-105" />
        {representative && (
          <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/45 px-1.5 py-0.5 text-[9px] font-medium leading-none text-white">
            Representative image
          </span>
        )}
      </div>
    );
  }
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-brand-100 via-cream-200 to-brand-50 ${className}`}
      role="img"
      aria-label={`${alt} (photo coming soon)`}
    >
      <svg viewBox="0 0 64 64" className="h-1/3 w-1/3 text-brand-300" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <ellipse cx="32" cy="38" rx="24" ry="8" />
        <path d="M8 38c0 10 10.7 16 24 16s24-6 24-16" />
        <path d="M24 26c0-4 4-4 4-8m6 8c0-4 4-4 4-8m-22 8c0-3 3-3 3-6" strokeLinecap="round" />
      </svg>
    </div>
  );
}
