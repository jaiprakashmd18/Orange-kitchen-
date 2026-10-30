import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { CartView } from "./CartView";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };

export default async function CartPage() {
  const user = await getSessionUser();
  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="mb-8 text-4xl">Your cart</h1>
      <CartView signedIn={Boolean(user)} />
    </div>
  );
}
