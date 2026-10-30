import clsx from "clsx";

const TONES = {
  neutral: "bg-charcoal/5 text-charcoal-700",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  success: "bg-leaf-50 text-leaf ring-green-200",
  danger: "bg-chilli-50 text-chilli ring-red-200",
  info: "bg-brand-50 text-brand-700 ring-brand-200",
} as const;

export function Badge({ tone = "neutral", children, className }: { tone?: keyof typeof TONES; children: React.ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ring-transparent", TONES[tone], className)}>
      {children}
    </span>
  );
}
