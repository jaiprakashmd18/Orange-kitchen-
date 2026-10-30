import Link from "next/link";

export function EmptyState({
  title,
  description,
  action,
  icon = "🍽️",
}: {
  title: string;
  description?: React.ReactNode;
  action?: { href: string; label: string };
  icon?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-charcoal/15 bg-white/60 px-6 py-14 text-center">
      <span className="text-4xl" aria-hidden>
        {icon}
      </span>
      <h3 className="mt-4 font-display text-xl">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm text-charcoal-500">{description}</p>}
      {action && (
        <Link href={action.href} className="btn-primary mt-6">
          {action.label}
        </Link>
      )}
    </div>
  );
}
