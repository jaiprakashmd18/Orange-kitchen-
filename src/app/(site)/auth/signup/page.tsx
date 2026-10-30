import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignupForm } from "@/components/auth/SignupForm";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getSessionUser()) redirect("/account");
  return (
    <AuthCard
      title="Create your account"
      subtitle="Browse freely — an account is only needed to place orders."
      footer={<>Already have an account? <Link href={`/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="link">Log in</Link></>}
    >
      <SignupForm next={next ?? "/account"} />
    </AuthCard>
  );
}
