import Link from "next/link";

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="container-page flex justify-center py-12 sm:py-20">
      <div className="w-full max-w-md">
        <div className="card p-6 sm:p-8">
          <h1 className="text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-charcoal-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-charcoal-500">{footer}</div>}
        <p className="mt-4 text-center text-xs text-charcoal-400">
          By continuing you agree to our <Link href="/policies#terms" className="underline">terms</Link> and{" "}
          <Link href="/policies#privacy" className="underline">privacy policy</Link>.
        </p>
      </div>
    </div>
  );
}
