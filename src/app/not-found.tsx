import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-cream px-6 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-5xl">This page isn&apos;t on the menu</h1>
      <p className="mt-3 text-charcoal-500">The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="btn-primary">Go home</Link>
        <Link href="/menu" className="btn-secondary">View menu</Link>
      </div>
    </main>
  );
}
