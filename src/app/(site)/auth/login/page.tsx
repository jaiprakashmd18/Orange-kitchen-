import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { getSessionUser } from "@/lib/auth";
import { safeNext } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; setup?: string }> }) {
  const { next, error, setup } = await searchParams;
  const user = await getSessionUser();
  if (user && error !== "forbidden") redirect(safeNext(next));
  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to place orders, track deliveries and reorder your favourites."
      footer={<>New to Orange Kitchen? <Link href={`/auth/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="link">Create an account</Link></>}
    >
      {setup === "done" && <p className="mb-4 rounded-xl bg-leaf-50 px-4 py-3 text-sm text-leaf" role="status">🎉 Your website is set up! Log in with the owner email and password you just chose.</p>}
      {error && <p className="field-error mb-4" role="alert">{error === "link"
            ? "That link is invalid or has expired. Please try again."
            : error === "forbidden"
              ? `${user?.email ?? "This account"} doesn't have access to that page. Log in with the admin email set in Vercel (ADMIN_EMAIL), or ask an admin to add you in Admin → Staff access.`
              : "Please log in to continue."}</p>}
      <LoginForm next={next ?? "/account"} />
    </AuthCard>
  );
}
