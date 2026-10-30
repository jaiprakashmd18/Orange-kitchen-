import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AddressBook } from "./AddressBook";
import type { Address } from "@/lib/types";

export const metadata: Metadata = { title: "Saved addresses", robots: { index: false } };

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");
  const supabase = await createClient();
  const [{ data }, { data: profile }] = await Promise.all([
    supabase.from("customer_addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("profiles").select("full_name, phone").eq("id", user.id).single(),
  ]);
  return (
    <div>
      <h1 className="mb-6 text-4xl">Saved addresses</h1>
      <AddressBook addresses={(data ?? []) as Address[]} defaults={{ full_name: profile?.full_name ?? "", phone: profile?.phone ?? "" }} />
    </div>
  );
}
