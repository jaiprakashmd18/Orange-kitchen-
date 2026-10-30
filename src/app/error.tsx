"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl">Something went wrong</h1>
      <p className="mt-3 text-charcoal-500">Please try again. If it keeps happening, call us and we&apos;ll help with your order.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-charcoal-400">Ref: {error.digest}</p>}
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reset} className="btn-primary">Try again</button>
        <Link href="/" className="btn-secondary">Home</Link>
      </div>
    </main>
  );
}
