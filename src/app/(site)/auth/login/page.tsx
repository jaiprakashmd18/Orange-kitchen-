import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { getSessionUser } from "@/lib/auth";
import { safeNext } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  if (await getSessionUser()) redirect(safeNext(next));
  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to place orders, track deliveries and reorder your favourites."
      footer={<>New to Orange Kitchen? <Link href={`/auth/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="link">Create an account</Link></>}
    >
      {error && <p className="field-error mb-4" role="alert">{error === "link" ? "That link is invalid or has expired. Please try again." : "Please log in to continue."}</p>}
      <LoginForm next={next ?? "/account"} />
    </AuthCard>
  );
}
